const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');

const {
    resolveCwd,
    assertApiPluginExists,
    assertWebPluginExists,
    resolvePluginsDir,
    resolveWebPluginsDir,
    findPluginJar,
    findDeployedPluginJars,
    findWebBundle,
} = require('../plugin-utils');

async function pluginDeploy(pluginName, opts) {
    const cwd    = resolveCwd(opts);
    const target = (opts.target || 'api').toLowerCase();
    const doApi  = target === 'api' || target === 'all';
    const doWeb  = target === 'web' || target === 'all';

    // === Deploy API (copy JAR → platform-app/plugins/) ===
    if (doApi) {
        const { pluginId, moduleDir, moduleName } = await assertApiPluginExists(cwd, pluginName);
        const pluginsDir = resolvePluginsDir(cwd, opts);
        const sourceJar  = await findPluginJar(moduleDir, pluginId);
        const targetJar  = path.join(pluginsDir, path.basename(sourceJar));

        if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] ensure dir ${pluginsDir}`));
            console.log(chalk.cyan(`[dry-run] copy ${path.relative(cwd, sourceJar)} → ${path.relative(cwd, targetJar)}`));
        } else {
            const spinner = ora(`Deploying API plugin ${moduleName}...`).start();
            await fs.ensureDir(pluginsDir);

            if (!opts.keepOld) {
                const oldJars = await findDeployedPluginJars(pluginsDir, pluginId);
                for (const old of oldJars) {
                    if (old !== targetJar) await fs.remove(old);
                }
            }

            await fs.copy(sourceJar, targetJar, { overwrite: true });
            spinner.succeed(`API plugin deployed → ${path.relative(cwd, targetJar)}`);
        }
    }

    // === Deploy Web (copy dist/*.umd.js → platform-app/public/plugins/) ===
    if (doWeb) {
        const { pluginId, pluginDir } = await assertWebPluginExists(cwd, pluginName);
        const webPluginsDir = resolveWebPluginsDir(cwd, opts);

        // Cari bundle hasil build di dist/
        const sourceBundle = await findWebBundle(pluginDir, pluginName);
        const targetBundle = path.join(webPluginsDir, path.basename(sourceBundle));

        if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] ensure dir ${webPluginsDir}`));
            console.log(chalk.cyan(`[dry-run] copy ${path.relative(cwd, sourceBundle)} → ${path.relative(cwd, targetBundle)}`));
            console.log(chalk.cyan(`[dry-run] update ${path.relative(cwd, path.join(webPluginsDir, 'manifest.json'))} with /plugins/${path.basename(targetBundle)}`));
            // Map file jika ada
            const sourceMap = sourceBundle + '.map';
            if (await fs.pathExists(sourceMap)) {
                console.log(chalk.cyan(`[dry-run] copy ${path.relative(cwd, sourceMap)} → ${path.relative(cwd, targetBundle + '.map')}`));
            }
        } else {
            const spinner = ora(`Deploying web plugin ${pluginId}...`).start();
            await fs.ensureDir(webPluginsDir);
            await fs.copy(sourceBundle, targetBundle, { overwrite: true });

            // Copy .map jika ada
            const sourceMap = sourceBundle + '.map';
            if (await fs.pathExists(sourceMap)) {
                await fs.copy(sourceMap, targetBundle + '.map', { overwrite: true });
            }

            await updateWebPluginManifest(webPluginsDir, `/plugins/${path.basename(targetBundle)}`);

            spinner.succeed(`Web plugin deployed → ${path.relative(cwd, targetBundle)}`);
        }
    }
}

async function updateWebPluginManifest(webPluginsDir, pluginUrl) {
    const manifestPath = path.join(webPluginsDir, 'manifest.json');
    let urls = [];

    if (await fs.pathExists(manifestPath)) {
        const current = await fs.readJson(manifestPath);
        if (!Array.isArray(current)) {
            throw new Error(`Invalid web plugin manifest: ${manifestPath}. Expected a JSON array.`);
        }

        urls = current.map((entry) => {
            if (typeof entry === 'string') return entry;
            if (entry && typeof entry.url === 'string') return entry.url;
            throw new Error(`Invalid web plugin manifest entry in ${manifestPath}. Expected string or { "url": string }.`);
        });
    }

    const withoutSamePlugin = urls.filter((url) => path.basename(url) !== path.basename(pluginUrl));
    const nextUrls = [...withoutSamePlugin, pluginUrl];

    await fs.writeJson(manifestPath, nextUrls, { spaces: 2 });
}

module.exports = pluginDeploy;
