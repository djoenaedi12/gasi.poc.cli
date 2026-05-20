const path = require('path');
const { spawn } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');

const {
    resolveCwd,
    assertApiPluginExists,
    assertWebPluginExists,
} = require('../plugin-utils');

async function pluginBuild(pluginName, opts) {
    const cwd    = resolveCwd(opts);
    const target = (opts.target || 'api').toLowerCase();
    const doApi  = target === 'api' || target === 'all';
    const doWeb  = target === 'web' || target === 'all';

    // === Build API ===
    if (doApi) {
        const { moduleName } = await assertApiPluginExists(cwd, pluginName);

        const args = [];
        if (!opts.verbose) args.push('-q');
        args.push('clean', 'package', '-pl', moduleName, '-am');
        if (opts.skipTests) args.push('-DskipTests');
        if (opts.profile)   args.push(`-P${opts.profile}`);

        if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] mvn ${args.join(' ')}`));
        } else {
            const spinner = ora(`Building API plugin ${moduleName}...`).start();
            try {
                await runMaven(args, cwd, opts.verbose);
                spinner.succeed(`API plugin ${moduleName} built.`);
            } catch (err) {
                spinner.fail(`API build failed: ${err.message}`);
                throw err;
            }
        }
    }

    // === Build Web ===
    if (doWeb) {
        const { pluginDir } = await assertWebPluginExists(cwd, pluginName);
        const pluginId      = path.basename(pluginDir);
        const workspaceName = `plugins/${pluginId}`;

        if (opts.dryRun) {
            console.log(chalk.cyan(`[dry-run] npm run build -w ${workspaceName}`));
        } else {
            const spinner = ora(`Building web plugin ${pluginId}...`).start();
            try {
                await runNpm(['run', 'build', '-w', workspaceName], cwd);
                spinner.succeed(`Web plugin ${pluginId} built → platform-app/public/plugins/`);
            } catch (err) {
                spinner.fail(`Web build failed: ${err.message}`);
                throw err;
            }
        }
    }
}

function runMaven(args, cwd, verbose) {
    return new Promise((resolve, reject) => {
        const child = spawn('mvn', args, {
            cwd,
            shell: process.platform === 'win32',
            stdio: verbose ? 'inherit' : ['ignore', 'inherit', 'inherit'],
        });
        child.on('error', reject);
        child.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error(`Maven exited with code ${code}.`));
        });
    });
}

function runNpm(args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn('npm', args, {
            cwd,
            shell: process.platform === 'win32',
            stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error(`npm exited with code ${code}.`));
        });
    });
}

module.exports = pluginBuild;
