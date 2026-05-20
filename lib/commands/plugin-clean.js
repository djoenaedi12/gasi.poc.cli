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
    findDeployedPluginJars,
    findDeployedWebBundle,
} = require('../plugin-utils');

async function pluginClean(pluginName, opts) {
    const cwd    = resolveCwd(opts);
    const target = (opts.target || 'api').toLowerCase();
    const doApi  = target === 'api' || target === 'all';
    const doWeb  = target === 'web' || target === 'all';

    // === Clean API (hapus JAR dari platform-app/plugins/) ===
    if (doApi) {
        const { pluginId, moduleName } = await assertApiPluginExists(cwd, pluginName);
        const pluginsDir   = resolvePluginsDir(cwd, opts);
        const deployedJars = await findDeployedPluginJars(pluginsDir, pluginId);

        if (!deployedJars.length) {
            console.log(chalk.yellow(`No deployed JARs found for ${pluginId}.`));
        } else if (opts.dryRun) {
            deployedJars.forEach((j) => console.log(chalk.cyan(`[dry-run] remove ${j}`)));
        } else {
            const spinner = ora(`Removing deployed JARs for ${moduleName}...`).start();
            for (const jar of deployedJars) await fs.remove(jar);
            spinner.succeed(`Removed ${deployedJars.length} JAR(s) for ${pluginId}.`);
        }
    }

    // === Clean Web (hapus UMD dari platform-app/public/plugins/) ===
    if (doWeb) {
        const { pluginId } = await assertWebPluginExists(cwd, pluginName);
        const webPluginsDir = resolveWebPluginsDir(cwd, opts);
        const bundlePath    = await findDeployedWebBundle(webPluginsDir, pluginName);

        if (!bundlePath) {
            console.log(chalk.yellow(`No web bundle found for ${pluginId}.`));
        } else if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] remove ${bundlePath}`));
            console.log(chalk.cyan(`[dry-run] remove /plugins/${path.basename(bundlePath)} from ${path.join(webPluginsDir, 'manifest.json')}`));
        } else {
            const spinner = ora(`Removing web bundle for ${pluginId}...`).start();
            await fs.remove(bundlePath);
            // Hapus juga source map jika ada
            const mapFile = bundlePath + '.map';
            if (await fs.pathExists(mapFile)) await fs.remove(mapFile);
            await removeFromWebPluginManifest(webPluginsDir, `/plugins/${path.basename(bundlePath)}`);
            spinner.succeed(`Removed web bundle → ${path.relative(cwd, bundlePath)}`);
        }
    }
}

async function removeFromWebPluginManifest(webPluginsDir, pluginUrl) {
    const manifestPath = path.join(webPluginsDir, 'manifest.json');
    if (!(await fs.pathExists(manifestPath))) return;

    const current = await fs.readJson(manifestPath);
    if (!Array.isArray(current)) {
        throw new Error(`Invalid web plugin manifest: ${manifestPath}. Expected a JSON array.`);
    }

    const next = current.filter((entry) => {
        const url = typeof entry === 'string' ? entry : entry?.url;
        return url !== pluginUrl && path.basename(url || '') !== path.basename(pluginUrl);
    });

    await fs.writeJson(manifestPath, next, { spaces: 2 });
}

module.exports = pluginClean;
