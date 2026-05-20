const path = require('path');
const fs = require('fs-extra');

const { listPluginModules } = require('./maven-pom');

function resolveCwd(opts = {}) {
    return opts.cwd ? path.resolve(opts.cwd) : process.cwd();
}

function normalizePluginName(name) {
    const raw = (name || '').trim();
    if (!raw) throw new Error('Plugin name is required.');
    return raw.endsWith('-plugin') ? raw : `${raw}-plugin`;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function assertProjectRoot(cwd) {
    const parentPom = path.join(cwd, 'pom.xml');
    if (!(await fs.pathExists(parentPom))) {
        throw new Error(`No pom.xml found in ${cwd}. Run from the project root or use --cwd.`);
    }
    return parentPom;
}

async function assertApiPluginExists(cwd, pluginName) {
    const pluginId   = normalizePluginName(pluginName);
    const moduleName = `plugins/${pluginId}`;

    const parentPom = path.join(cwd, 'pom.xml');
    if (!(await fs.pathExists(parentPom))) {
        throw new Error(`No pom.xml found in ${cwd}.`);
    }

    const modules = await listPluginModules(parentPom);
    if (!modules.includes(moduleName)) {
        throw new Error(`Plugin '${moduleName}' is not registered in pom.xml.`);
    }

    const moduleDir = path.join(cwd, moduleName);
    if (!(await fs.pathExists(moduleDir))) {
        throw new Error(`Plugin directory does not exist: ${moduleDir}`);
    }

    return { pluginId, moduleName, moduleDir };
}

// backward compat
async function assertPluginModuleExists(cwd, pluginName) {
    return assertApiPluginExists(cwd, pluginName);
}

function resolvePluginsDir(cwd, opts = {}) {
    return path.resolve(cwd, opts.pluginsDir || path.join('platform-app', 'plugins'));
}

async function findPluginJar(moduleDir, pluginId) {
    const targetDir = path.join(moduleDir, 'target');
    if (!(await fs.pathExists(targetDir))) {
        throw new Error(`target/ not found in ${moduleDir}. Build the plugin first.`);
    }

    const entries    = await fs.readdir(targetDir);
    const candidates = [];
    for (const entry of entries) {
        if (!entry.endsWith('.jar')) continue;
        if (!entry.startsWith(`${pluginId}-`)) continue;
        if (entry.endsWith('-sources.jar') || entry.endsWith('-javadoc.jar')) continue;
        if (entry.startsWith('original-')) continue;
        const fullPath = path.join(targetDir, entry);
        const stat     = await fs.stat(fullPath);
        if (stat.isFile()) candidates.push({ path: fullPath, mtimeMs: stat.mtimeMs });
    }

    if (!candidates.length) {
        throw new Error(`No deployable JAR found in ${targetDir}. Build the plugin first.`);
    }

    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return candidates[0].path;
}

async function findDeployedPluginJars(pluginsDir, pluginId) {
    if (!(await fs.pathExists(pluginsDir))) return [];
    const entries = await fs.readdir(pluginsDir);
    return entries
        .filter((e) => e.endsWith('.jar') && e.startsWith(`${pluginId}-`))
        .map((e) => path.join(pluginsDir, e));
}

// ─── Web helpers ──────────────────────────────────────────────────────────────

async function assertMonorepoRoot(cwd) {
    const packageJson = path.join(cwd, 'package.json');
    if (!(await fs.pathExists(packageJson))) {
        throw new Error(`No package.json found in ${cwd}. Run from the monorepo root or use --cwd.`);
    }
    const pkg = await fs.readJson(packageJson);
    if (!pkg.workspaces) {
        throw new Error(`package.json has no "workspaces" field. Are you in the monorepo root?`);
    }
    return packageJson;
}

async function assertWebPluginExists(cwd, pluginName) {
    const pluginId  = normalizePluginName(pluginName);
    const pluginDir = path.join(cwd, 'plugins', pluginId);

    if (!(await fs.pathExists(pluginDir))) {
        throw new Error(`Web plugin directory does not exist: ${pluginDir}`);
    }

    const pkgJson = path.join(pluginDir, 'package.json');
    if (!(await fs.pathExists(pkgJson))) {
        throw new Error(`No package.json found in ${pluginDir}. Is this a web plugin?`);
    }

    return { pluginId, pluginDir };
}

function resolveWebPluginsDir(cwd, opts = {}) {
    // Target deploy: platform-app/public/plugins/
    return path.resolve(cwd, opts.pluginsDir || path.join('platform-app', 'public', 'plugins'));
}

/**
 * Cari file .umd.js hasil build di dist/ folder plugin.
 * Build output ada di plugins/{name}-plugin/dist/
 */
async function findWebBundle(pluginDir, pluginName) {
    const pluginId  = normalizePluginName(pluginName);
    const name      = pluginId.replace('-plugin', '');
    const fileName  = `plugin-${name}.umd.js`;
    const distPath  = path.join(pluginDir, 'dist', fileName);

    if (!(await fs.pathExists(path.join(pluginDir, 'dist')))) {
        throw new Error(`dist/ not found in ${pluginDir}. Build the plugin first with: gasi plugin build ${name} --target web`);
    }

    if (!(await fs.pathExists(distPath))) {
        throw new Error(`Bundle not found: ${distPath}. Build the plugin first with: gasi plugin build ${name} --target web`);
    }

    return distPath;
}

/**
 * Cari file .umd.js yang sudah di-deploy di platform-app/public/plugins/
 */
async function findDeployedWebBundle(webPluginsDir, pluginName) {
    const pluginId = normalizePluginName(pluginName);
    const name     = pluginId.replace('-plugin', '');
    const fileName = `plugin-${name}.umd.js`;
    const fullPath = path.join(webPluginsDir, fileName);
    return (await fs.pathExists(fullPath)) ? fullPath : null;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

async function detectPluginFromCwd(cwd) {
    let current = path.resolve(cwd);
    while (current !== path.dirname(current)) {
        const dirName = path.basename(current);
        if (dirName.endsWith('-plugin')) {
            const parentDir = path.dirname(current);
            if (path.basename(parentDir) === 'plugins') {
                const projectRoot = path.dirname(parentDir);
                const parentPom   = path.join(projectRoot, 'pom.xml');
                if (await fs.pathExists(parentPom)) {
                    return { pluginDir: current, pluginModule: `plugins/${dirName}`, projectRoot };
                }
            }
        }
        current = path.dirname(current);
    }
    return null;
}

async function getPluginModules(cwd) {
    const parentPom = await assertProjectRoot(cwd);
    return listPluginModules(parentPom);
}

module.exports = {
    resolveCwd,
    normalizePluginName,
    detectPluginFromCwd,
    // api
    assertProjectRoot,
    assertPluginModuleExists,
    assertApiPluginExists,
    resolvePluginsDir,
    findPluginJar,
    findDeployedPluginJars,
    getPluginModules,
    // web
    assertMonorepoRoot,
    assertWebPluginExists,
    resolveWebPluginsDir,
    findWebBundle,
    findDeployedWebBundle,
};
