const path = require('path');
const chalk = require('chalk');

const { resolveCwd, assertProjectRoot, detectPluginFromCwd, getPluginModules, resolvePluginModuleName } = require('../plugin-utils');
const {
    loadResourceSpecFile,
    normalizeResourceSpecDocument,
    assertUniqueEntityNames,
} = require('../resource-spec');
const {
    manifestRelativePath,
    loadGeneratedManifest,
    getGeneratedResource,
    hashResourceSpec,
} = require('../generated-manifest');

async function resourcePlan(opts) {
    const cwd = resolveCwd(opts);
    const filePaths = normalizeFileOptions(opts.file);

    if (!filePaths.length) {
        throw new Error('At least one -f, --file <file> is required.');
    }

    const target = normalizeTarget(opts.target);
    const context = await resolvePlanContext(opts, cwd, target);
    const resources = await loadResourceSpecs(filePaths, context.cwd);
    const manifest = await loadGeneratedManifest(context.manifestCwd, target);

    console.log(chalk.cyan.bold('\n  gasi — Resource Sync Plan\n'));
    console.log(`  Target   : ${chalk.green(target)}`);
    console.log(`  Plugin   : ${chalk.green(context.pluginModule)}`);
    console.log(`  Manifest : ${chalk.gray(manifestRelativePath(target))}`);
    console.log();

    let createCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;

    for (const resource of resources) {
        const record = getGeneratedResource(manifest, context.pluginModule, resource.entityName);
        const hash = hashResourceSpec(resource);
        const source = resource.sourceFile ? path.relative(context.cwd, resource.sourceFile) : '(interactive)';

        if (!record) {
            createCount++;
            console.log(`${chalk.green('CREATE')}    ${resource.entityName} ${chalk.gray(source)}`);
        } else if (record.specHash !== hash) {
            updateCount++;
            console.log(`${chalk.yellow('UPDATE')}    ${resource.entityName} ${chalk.gray(source)}`);
        } else {
            unchangedCount++;
            console.log(`${chalk.gray('UNCHANGED')} ${resource.entityName} ${chalk.gray(source)}`);
        }
    }

    console.log();
    console.log(`  Create    : ${chalk.green(createCount)}`);
    console.log(`  Update    : ${chalk.yellow(updateCount)}`);
    console.log(`  Unchanged : ${chalk.gray(unchangedCount)}`);
    console.log();
}

async function resolvePlanContext(opts, cwd, target) {
    if (!opts.plugin) {
        throw new Error('--plugin is required.');
    }

    if (target === 'web') {
        const webDir = path.resolve(cwd, opts.plugin);
        return {
            cwd,
            manifestCwd: webDir,
            pluginModule: opts.plugin,
        };
    }

    const detected = await detectPluginFromCwd(cwd);
    if (detected) {
        return {
            cwd: detected.projectRoot,
            manifestCwd: detected.pluginDir,
            pluginModule: detected.pluginModule,
        };
    }

    await assertProjectRoot(cwd);
    const pluginModules = await getPluginModules(cwd);
    const pluginModule = resolvePluginModuleName(opts.plugin, pluginModules);

    return {
        cwd,
        manifestCwd: path.join(cwd, pluginModule),
        pluginModule,
    };
}

async function loadResourceSpecs(filePaths, cwd) {
    const resources = [];

    for (const filePath of filePaths) {
        const loaded = await loadResourceSpecFile(filePath, cwd);
        const sourceLabel = path.relative(cwd, loaded.file);
        const normalized = normalizeResourceSpecDocument(loaded.spec, null, sourceLabel);

        for (const resource of normalized) {
            resources.push({
                ...resource,
                sourceFile: loaded.file,
            });
        }
    }

    assertUniqueEntityNames(resources, 'resource files');
    return resources;
}

function normalizeFileOptions(fileOption) {
    if (!fileOption) {
        return [];
    }

    if (Array.isArray(fileOption)) {
        return fileOption.filter(Boolean);
    }

    return [fileOption];
}

function normalizeTarget(target) {
    const normalized = String(target || '').toLowerCase();
    const aliases = {
        be: 'api',
        backend: 'api',
        fe: 'web',
        frontend: 'web',
    };
    const resolved = aliases[normalized] || normalized;

    if (!['api', 'web'].includes(resolved)) {
        throw new Error(`Invalid --target "${target}". Allowed: api, web.`);
    }

    return resolved;
}

module.exports = resourcePlan;
