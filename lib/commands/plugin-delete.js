const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');

const { unregisterFromParentPom } = require('../maven-pom');
const {
    resolveCwd,
    normalizePluginName,
    assertApiPluginExists,
    assertWebPluginExists,
    resolvePluginsDir,
    resolveWebPluginsDir,
    findDeployedPluginJars,
    findDeployedWebBundle,
} = require('../plugin-utils');

async function pluginDelete(pluginName, opts) {
    const cwd    = resolveCwd(opts);
    const target = (opts.target || 'api').toLowerCase();
    const doApi  = target === 'api' || target === 'all';
    const doWeb  = target === 'web' || target === 'all';

    const pluginId  = normalizePluginName(pluginName);
    const pluginDir = path.join(cwd, 'plugins', pluginId);

    // Kumpulkan info apa yang akan dihapus
    const plan = { api: null, web: null };

    if (doApi) {
        try {
            const info       = await assertApiPluginExists(cwd, pluginName);
            const pluginsDir = resolvePluginsDir(cwd, opts);
            const jars       = opts.keepDeployed ? [] : await findDeployedPluginJars(pluginsDir, info.pluginId);
            plan.api = { ...info, pluginsDir, jars };
        } catch (err) {
            console.log(chalk.yellow(`⚠ API plugin not found, skipping: ${err.message}`));
        }
    }

    if (doWeb) {
        try {
            const info          = await assertWebPluginExists(cwd, pluginName);
            const webPluginsDir = resolveWebPluginsDir(cwd, opts);
            const bundle        = opts.keepDeployed ? null : await findDeployedWebBundle(webPluginsDir, pluginName);
            plan.web = { ...info, webPluginsDir, bundle };
        } catch (err) {
            console.log(chalk.yellow(`⚠ Web plugin not found, skipping: ${err.message}`));
        }
    }

    if (!plan.api && !plan.web) {
        throw new Error(`Plugin '${pluginId}' not found (neither API nor web).`);
    }

    // Tampilkan plan
    printPlan(plan, cwd);

    if (opts.dryRun) return;

    // Konfirmasi
    if (!opts.yes) {
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Delete ${pluginId}? This cannot be undone.`,
            default: false,
        }]);
        if (!confirm) {
            console.log(chalk.yellow('Cancelled.'));
            return;
        }
    }

    // === Hapus API ===
    if (plan.api) {
        const spinner = ora(`Deleting API plugin ${plan.api.moduleName}...`).start();
        try {
            const parentPom = path.join(cwd, 'pom.xml');
            await unregisterFromParentPom(parentPom, plan.api.moduleName);
            await fs.remove(plan.api.moduleDir);
            for (const jar of plan.api.jars) await fs.remove(jar);
            spinner.succeed(`API plugin ${plan.api.moduleName} deleted.`);
        } catch (err) {
            spinner.fail(`Failed to delete API plugin: ${err.message}`);
            throw err;
        }
    }

    // === Hapus Web ===
    if (plan.web) {
        const spinner = ora(`Deleting web plugin ${plan.web.pluginId}...`).start();
        try {
            // Hapus bundle dari public/plugins jika ada
            if (plan.web.bundle) {
                await fs.remove(plan.web.bundle);
                const mapFile = plan.web.bundle + '.map';
                if (await fs.pathExists(mapFile)) await fs.remove(mapFile);
            }

            // Hapus folder plugin (jika belum dihapus oleh API delete)
            if (await fs.pathExists(plan.web.pluginDir)) {
                await fs.remove(plan.web.pluginDir);
            }

            // Unregister dari package.json workspaces jika tidak ada lagi plugin
            await unregisterWebPluginFromWorkspace(cwd, pluginId);

            spinner.succeed(`Web plugin ${plan.web.pluginId} deleted.`);
        } catch (err) {
            spinner.fail(`Failed to delete web plugin: ${err.message}`);
            throw err;
        }
    }

    console.log(chalk.green.bold(`\n✓ Plugin ${pluginId} deleted.\n`));
}

async function unregisterWebPluginFromWorkspace(cwd, pluginId) {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) return;

    // Cek apakah masih ada plugin lain
    const pluginsDir = path.join(cwd, 'plugins');
    if (await fs.pathExists(pluginsDir)) {
        const remaining = await fs.readdir(pluginsDir);
        const hasOtherPlugins = remaining.some((d) => d !== pluginId && d.endsWith('-plugin'));
        if (hasOtherPlugins) return; // Masih ada plugin lain, jangan hapus glob
    }

    // Tidak ada plugin lain — hapus plugins/* dari workspaces
    const pkg = await fs.readJson(packageJsonPath);
    const before = pkg.workspaces || [];
    pkg.workspaces = before.filter((w) => w !== 'plugins/*' && w !== `plugins/${pluginId}`);

    if (pkg.workspaces.length !== before.length) {
        await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    }
}

function printPlan(plan, cwd) {
    console.log(chalk.bold('\nDelete plan:'));

    if (plan.api) {
        console.log(chalk.bold('\n  API:'));
        console.log(`    Unregister from : pom.xml`);
        console.log(`    Remove dir      : ${path.relative(cwd, plan.api.moduleDir)}`);
        if (plan.api.jars.length) {
            plan.api.jars.forEach((j) => console.log(`    Remove JAR      : ${path.relative(cwd, j)}`));
        } else {
            console.log(`    Remove JAR      : (none deployed)`);
        }
    }

    if (plan.web) {
        console.log(chalk.bold('\n  Web:'));
        console.log(`    Remove dir      : plugins/${plan.web.pluginId}`);
        if (plan.web.bundle) {
            console.log(`    Remove bundle   : ${path.relative(cwd, plan.web.bundle)}`);
        } else {
            console.log(`    Remove bundle   : (none deployed)`);
        }
    }

    console.log('');
}

module.exports = pluginDelete;
