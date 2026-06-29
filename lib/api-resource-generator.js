const path = require('path');
const fs = require('fs-extra');

const { renderTemplateTree } = require('./api-template-engine');
const { buildResourceContext } = require('./api-resource-templates');
const { addGeneratedHeader } = require('./generated-header');

/**
 * Resolve the full Java package for a plugin by reading plugin.properties.
 */
async function resolvePluginPackage(pluginDir) {
    const propsFile = path.join(pluginDir, 'src', 'main', 'resources', 'plugin.properties');
    if (await fs.pathExists(propsFile)) {
        const content = await fs.readFile(propsFile, 'utf8');
        const match = content.match(/^plugin\.class[ \t]*=[ \t]*([^\r\n]*)/m);
        if (match) {
            const fqcn = match[1].trim();
            const lastDot = fqcn.lastIndexOf('.');
            if (lastDot > 0) {
                return fqcn.substring(0, lastDot);
            }
        }
    }

    throw new Error(
        `Could not determine the Java package for plugin at ${pluginDir}. ` +
        `Ensure plugin.properties contains a valid plugin.class entry.`,
    );
}

/**
 * Extract the domain segment from the full package.
 * e.g. "gasi.gps.payroll" → "payroll"
 */
function extractDomain(pkg) {
    const parts = pkg.split('.');
    return parts[parts.length - 1];
}

/**
 * Generate all API resource files for a single entity in the target plugin.
 *
 * Uses the template files in templates/api/resource/ with token replacement.
 *
 * @returns {string[]} list of absolute paths of generated files.
 */
async function generateApiResource({
    cwd,
    pluginDir,
    pluginName,
    pluginPrefix,
    entityName,
    tableName,
    fields,
    parent,
    apiStyle,
    embedInParentDto,
    as,
    exposeApi,
    ui,
    mode = 'crud',
    force = false,
}) {
    const pkg = await resolvePluginPackage(pluginDir);
    const domain = extractDomain(pkg);
    const effectiveExposeApi = exposeApi !== false;

    // Build the context with all computed token values
    const ctx = buildResourceContext({
        pkg,
        entityName,
        tableName,
        fields,
        pluginName,
        pluginPrefix,
        domain,
        parent,
        apiStyle,
        embedInParentDto,
        as,
        exposeApi: effectiveExposeApi,
        ui,
        mode,
    });

    // Collect files before rendering to check for conflicts
    const templateRoot = path.join(__dirname, '..', 'templates', 'api', 'resource');
    const targetRoot = path.join(pluginDir);

    // Check for existing files first
    const shouldInclude = (relPath) => shouldIncludeTemplate(relPath, effectiveExposeApi, mode, ctx);

    if (!force) {
        await checkConflicts(templateRoot, targetRoot, ctx, shouldInclude);
    }

    // Render all templates into the plugin directory
    await renderTemplateTree(templateRoot, targetRoot, ctx, {
        includeFlyway: true,
        shouldInclude,
        transformContent: addGeneratedHeader,
    });

    // Collect generated file paths for reporting
    const generated = await collectGeneratedPaths(templateRoot, targetRoot, ctx, shouldInclude);

    return generated;
}

async function generateApiEnums({ pluginDir, enums, force = false }) {
    if (!enums.length) {
        return [];
    }

    const pkg = await resolvePluginPackage(pluginDir);
    const domain = extractDomain(pkg);
    const basePkg = pkg.substring(0, pkg.lastIndexOf('.'));
    const pkgPath = basePkg.replace(/\./g, '/');
    const enumDir = path.join(pluginDir, 'src', 'main', 'java', pkgPath, domain, 'domain', 'model');
    const generated = [];

    for (const enumSpec of enums) {
        const targetPath = path.join(enumDir, `${enumSpec.name}.java`);
        if (!force && await fs.pathExists(targetPath)) {
            throw new Error(`File already exists: ${targetPath}. Aborting to avoid overwriting.`);
        }

        await fs.ensureDir(enumDir);
        await fs.writeFile(targetPath, addGeneratedHeader(renderEnumFile(pkg, enumSpec), targetPath), 'utf8');
        generated.push(targetPath);
    }

    return generated;
}

function renderEnumFile(pkg, enumSpec) {
    const values = enumSpec.values || [];
    const body = values.length
        ? values.map((value, index) => `    ${value}${index === values.length - 1 ? '' : ','}`).join('\n')
        : '';

    return `package ${pkg}.domain.model;\n\npublic enum ${enumSpec.name} {\n${body}\n}\n`;
}

/**
 * Walk the template tree and check if any target file already exists.
 * Throws on conflict to avoid accidental overwrites.
 */
async function checkConflicts(templateRoot, targetRoot, ctx, shouldInclude) {
    const entries = await walk(templateRoot);

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        if (shouldInclude && !shouldInclude(relPath)) continue;

        const renderedRelPath = replacePathTokens(relPath, ctx);
        const targetPath = path.join(targetRoot, renderedRelPath);

        if (await fs.pathExists(targetPath)) {
            throw new Error(`File already exists: ${targetPath}. Aborting to avoid overwriting.`);
        }
    }
}

/**
 * Collect the absolute paths of all files that were generated.
 */
async function collectGeneratedPaths(templateRoot, targetRoot, ctx, shouldInclude) {
    const entries = await walk(templateRoot);
    const paths = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        if (shouldInclude && !shouldInclude(relPath)) continue;

        const renderedRelPath = replacePathTokens(relPath, ctx);
        const targetPath = path.join(targetRoot, renderedRelPath);
        paths.push(targetPath);
    }

    return paths;
}

// Re-use the same token replacement logic as api-template-engine.js
function replacePathTokens(p, ctx) {
    return p.replace(/\[\[([A-Z0-9_]+)\]\]/g, (match, key) => (key in ctx ? ctx[key] : match));
}

async function walk(dir) {
    const out = [];
    async function recurse(d) {
        const items = await fs.readdir(d, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(d, item.name);
            if (item.isDirectory()) {
                out.push({ fullPath: full, isDirectory: true, isFile: false });
                await recurse(full);
            } else if (item.isFile()) {
                out.push({ fullPath: full, isDirectory: false, isFile: true });
            }
        }
    }
    await recurse(dir);
    return out;
}

function shouldIncludeTemplate(relPath, exposeApi, mode = 'crud', ctx = {}) {
    const normalized = relPath.split(path.sep).join('/');
    if (normalized.endsWith('/application/hook/[[ENTITY_NAME]]ReferenceHook.java')
            && !ctx.HAS_REFERENCE_HOOK) {
        return false;
    }

    if (exposeApi) {
        if (mode === 'read') {
            const writeOnlySegments = [
                '/application/dto/',
            ];
            const writeOnlyFiles = [
                'CreateRequest.java',
                'UpdateRequest.java',
            ];

            if (
                writeOnlySegments.some((segment) => normalized.includes(segment)) &&
                writeOnlyFiles.some((suffix) => normalized.endsWith(suffix))
            ) {
                return false;
            }
        }

        return true;
    }

    const apiOnlySegments = [
        '/application/dto/',
        '/application/hook/',
        '/application/mapper/',
        '/application/service/',
        '/domain/port/inbound/',
        '/presentation/controller/',
    ];

    return !apiOnlySegments.some((segment) => normalized.includes(segment));
}

module.exports = { generateApiResource, generateApiEnums };
