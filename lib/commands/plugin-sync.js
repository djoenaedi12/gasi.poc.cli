const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

const pluginCreate = require('./plugin-create');
const { resolveCwd } = require('../plugin-utils');
const { loadPluginSpecFile, normalizePluginSpecDocument } = require('../plugin-spec');

async function pluginSync(opts) {
    const cwd = resolveCwd(opts);
    const loaded = await loadPluginSpecFile(requiredFile(opts), cwd);
    const spec = normalizePluginSpecDocument(loaded.spec, opts.target, path.relative(cwd, loaded.file));
    const pluginDir = path.join(cwd, 'plugins', `${spec.name}-plugin`);

    if (await fs.pathExists(pluginDir)) {
        console.log(chalk.gray(`Plugin already exists, unchanged: ${path.relative(cwd, pluginDir)}`));
        return;
    }

    await pluginCreate({
        cwd,
        target: spec.target,
        spec,
    });
}

function requiredFile(opts) {
    if (!opts.file) {
        throw new Error('-f, --file <file> is required.');
    }
    return opts.file;
}

module.exports = pluginSync;
