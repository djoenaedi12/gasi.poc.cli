const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

const { resolveCwd } = require('../plugin-utils');
const { loadPluginSpecFile, normalizePluginSpecDocument } = require('../plugin-spec');

async function pluginPlan(opts) {
    const cwd = resolveCwd(opts);
    const loaded = await loadPluginSpecFile(requiredFile(opts), cwd);
    const spec = normalizePluginSpecDocument(loaded.spec, opts.target, path.relative(cwd, loaded.file));
    const pluginDir = path.join(cwd, 'plugins', `${spec.name}-plugin`);
    const exists = await fs.pathExists(pluginDir);

    console.log(chalk.cyan.bold('\n  gasi — Plugin Sync Plan\n'));
    console.log(`  Target : ${chalk.green(spec.target)}`);
    console.log(`  Plugin : ${chalk.green(spec.name + '-plugin')}`);
    console.log(`  File   : ${chalk.gray(path.relative(cwd, loaded.file))}`);
    console.log();
    console.log(`${exists ? chalk.gray('UNCHANGED') : chalk.green('CREATE')} ${path.relative(cwd, pluginDir)}`);
    console.log();
}

function requiredFile(opts) {
    if (!opts.file) {
        throw new Error('-f, --file <file> is required.');
    }
    return opts.file;
}

module.exports = pluginPlan;
