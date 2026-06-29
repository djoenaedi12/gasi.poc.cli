const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

const { resolveCwd, assertProjectRoot, detectPluginFromCwd, getPluginModules, normalizePluginModuleName, resolvePluginModuleName } = require('../plugin-utils');
const { validateEntityName } = require('../validators');
const {
    manifestRelativePath,
    loadGeneratedManifest,
    getGeneratedResource,
    removeGeneratedResource,
} = require('../generated-manifest');

async function resourceDelete(entityName, opts) {
    console.log(chalk.cyan.bold('\n  gasi — Resource Delete\n'));

    const result = validateEntityName(entityName);
    if (result !== true) throw new Error(result);

    const target = normalizeTarget(opts.target);
    const context = await resolveDeleteContext(opts, target);
    const manifest = await loadGeneratedManifest(context.manifestCwd, target);
    const record = getGeneratedResource(manifest, context.pluginModule, entityName);

    if (!record) {
        throw new Error(
            `No manifest entry found for "${entityName}" in ${manifestRelativePath(target)} ` +
            `with plugin "${context.pluginModule}".`,
        );
    }

    const files = (record.generatedFiles || []).map((file) => path.join(context.manifestCwd, file));
    const existing = [];
    const missing = [];

    for (const file of files) {
        if (await fs.pathExists(file)) {
            existing.push(file);
        } else {
            missing.push(file);
        }
    }

    console.log(chalk.bold('Resource:'));
    console.log(`  Target   : ${chalk.green(target)}`);
    console.log(`  Plugin   : ${chalk.green(context.pluginModule)}`);
    console.log(`  Manifest : ${chalk.gray(manifestRelativePath(target))}`);
    console.log();

    if (existing.length) {
        console.log(chalk.bold('Files to delete:'));
        for (const file of existing) {
            console.log(chalk.red('    ' + path.relative(context.manifestCwd, file)));
        }
    } else {
        console.log(chalk.gray('  No existing files found. Manifest entry will still be removed.'));
    }

    if (missing.length) {
        console.log(chalk.gray(`\n  ${missing.length} file(s) already missing.`));
    }

    if (!opts.yes) {
        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Delete these generated files and manifest entry?', default: false },
        ]);
        if (!confirm) {
            console.log(chalk.yellow('Cancelled.'));
            return;
        }
    }

    const spinner = ora('Deleting generated resource files...').start();
    try {
        for (const file of existing) {
            assertInsideBoundary(file, context.cleanupBoundary);
            await fs.remove(file);
        }

        await cleanupEmptyDirectories(existing, context.cleanupBoundary);
        await removeGeneratedResource({
            cwd: context.manifestCwd,
            pluginModule: context.pluginModule,
            entityName,
            target,
        });

        spinner.succeed(`Deleted ${existing.length} file(s) and removed manifest entry.`);
    } catch (err) {
        spinner.fail('Failed to delete generated resource files.');
        throw err;
    }

    console.log(chalk.green.bold('\n✓ Resource deleted successfully!\n'));
}

async function resolveDeleteContext(opts, target) {
    if (!opts.plugin) {
        throw new Error('--plugin is required.');
    }

    const cwd = resolveCwd(opts);

    if (target === 'web') {
        const webDir = await resolveWebDeleteDir(opts, cwd);
        const pluginModule = path.relative(cwd, webDir).replace(/\\/g, '/') || opts.plugin;
        return {
            manifestCwd: webDir,
            pluginModule,
            cleanupBoundary: webDir,
        };
    }

    const detected = await detectPluginFromCwd(cwd);
    if (detected) {
        return {
            manifestCwd: detected.pluginDir,
            pluginModule: detected.pluginModule,
            cleanupBoundary: detected.pluginDir,
        };
    }

    await assertProjectRoot(cwd);
    const pluginModules = await getPluginModules(cwd);
    const pluginModule = resolvePluginModuleName(opts.plugin, pluginModules);
    const pluginDir = path.join(cwd, pluginModule);

    return {
        manifestCwd: pluginDir,
        pluginModule,
        cleanupBoundary: pluginDir,
    };
}

async function resolveWebDeleteDir(opts, cwd) {
    const candidates = [
        path.resolve(cwd, opts.plugin),
        path.resolve(cwd, normalizePluginModuleName(opts.plugin)),
    ];

    for (const candidate of [...new Set(candidates)]) {
        const packageJson = path.join(candidate, 'package.json');
        const srcDir = path.join(candidate, 'src');

        if (await fs.pathExists(packageJson) && await fs.pathExists(srcDir)) {
            return candidate;
        }
    }

    throw new Error(`Invalid --plugin for web target: ${opts.plugin}. Expected package.json and src/.`);
}

async function cleanupEmptyDirectories(files, boundary) {
    const dirs = [...new Set(files.map((file) => path.dirname(file)))]
        .sort((a, b) => b.length - a.length);

    for (const dir of dirs) {
        let current = dir;

        while (isInsideBoundary(current, boundary) && current !== boundary) {
            try {
                const entries = await fs.readdir(current);
                if (entries.length > 0) break;
                await fs.remove(current);
                current = path.dirname(current);
            } catch (_) {
                break;
            }
        }
    }
}

function assertInsideBoundary(file, boundary) {
    if (!isInsideBoundary(file, boundary)) {
        throw new Error(`Refusing to delete file outside plugin boundary: ${file}`);
    }
}

function isInsideBoundary(candidate, boundary) {
    const relative = path.relative(boundary, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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

module.exports = resourceDelete;
