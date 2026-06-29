const path = require('path');
const chalk = require('chalk');

const { resolveCwd } = require('../plugin-utils');
const { loadPluginSpecFile, normalizePluginSpecDocument } = require('../plugin-spec');

async function pluginValidate(opts) {
    const cwd = resolveCwd(opts);
    const loaded = await loadPluginSpecFile(requiredFile(opts), cwd);
    const spec = normalizePluginSpecDocument(loaded.spec, opts.target, path.relative(cwd, loaded.file));

    console.log(chalk.green.bold('\n✓ Plugin JSON is valid\n'));
    console.log(`  Target : ${chalk.green(spec.target)}`);
    console.log(`  Plugin : ${chalk.green(spec.name + '-plugin')}`);
    console.log(`  File   : ${chalk.gray(path.relative(cwd, loaded.file))}`);
    console.log();
}

function requiredFile(opts) {
    if (!opts.file) {
        throw new Error('-f, --file <file> is required.');
    }
    return opts.file;
}

module.exports = pluginValidate;
