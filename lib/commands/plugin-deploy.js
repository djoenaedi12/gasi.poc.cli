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
    findDeployedWebBundle,
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
            console.log(chalk.cyan(`[dry-run] copy ${sourceJar} → ${targetJar}`));
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

    // === Deploy Web (copy .umd.js → platform-app/public/plugins/) ===
    if (doWeb) {
        const { pluginId, pluginDir } = await assertWebPluginExists(cwd, pluginName);
        const webPluginsDir = resolveWebPluginsDir(cwd, opts);

        // File UMD ada di dalam pluginDir/dist atau langsung di webPluginsDir
        // vite.config.ts sudah set outDir ke platform-app/public/plugins/
        // jadi build langsung output ke sana — deploy hanya verifikasi file ada
        const bundlePath = await findDeployedWebBundle(webPluginsDir, pluginName);

        if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] verify ${webPluginsDir}/plugin-${pluginId.replace('-plugin','')}.umd.js`));
        } else {
            const spinner = ora(`Verifying web plugin bundle...`).start();
            if (!bundlePath) {
                spinner.fail(`Web bundle not found in ${webPluginsDir}. Run 'gasi plugin build ${pluginName} --target web' first.`);
                throw new Error(`Web plugin bundle not found.`);
            }
            spinner.succeed(`Web plugin bundle ready → ${path.relative(cwd, bundlePath)}`);
        }
    }
}

module.exports = pluginDeploy;
