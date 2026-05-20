const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');

const { renderTemplateTree } = require('./api-template-engine');

/**
 * Generate web plugin scaffold di monorepo.
 * Output ke plugins/{{name}}-plugin/ relatif dari webRoot (monorepo root).
 */
async function generateWebPlugin({ webRoot, name, version, description }) {
    await assertMonorepoRoot(webRoot);

    const targetDir = path.join(webRoot, 'plugins', `${name}-plugin`);

    if (await fs.pathExists(targetDir)) {
        throw new Error(`Web plugin directory already exists: ${targetDir}`);
    }

    const templateRoot = path.join(__dirname, '..', 'templates', 'web', 'plugin');
    const ctx = buildWebPluginContext({ name, version, description });

    await renderTemplateTree(templateRoot, targetDir, ctx);

    return targetDir;
}

async function assertMonorepoRoot(webRoot) {
    if (!webRoot) {
        throw new Error('webRoot is required for web plugin generation.');
    }

    const packageJson = path.join(webRoot, 'package.json');
    if (!(await fs.pathExists(packageJson))) {
        throw new Error(`No package.json found at: ${webRoot}`);
    }

    const pkg = await fs.readJson(packageJson);
    if (!pkg.workspaces) {
        throw new Error(`${webRoot}/package.json has no "workspaces" field. Run from the monorepo root.`);
    }
}

function buildWebPluginContext({ name, version, description }) {
    const pluginName      = _.kebabCase(name);                        // hr, payroll
    const pluginNameCamel = _.camelCase(name);                        // hr, payroll
    const pluginTitle     = _.startCase(name);                        // HR, Payroll
    const pluginGlobalName = `GasiPlugin${_.upperFirst(_.camelCase(name))}`; // GasiPluginHr

    return {
        PLUGIN_NAME:        pluginName,
        PLUGIN_NAME_CAMEL:  pluginNameCamel,
        PLUGIN_TITLE:       pluginTitle,
        PLUGIN_GLOBAL_NAME: pluginGlobalName,
        PLUGIN_VERSION:     version || '1.0.0',
        PLUGIN_DESCRIPTION: description || `${pluginTitle} plugin`,
    };
}

/**
 * Setelah generate web plugin, tambahkan ke root package.json workspaces
 * jika belum terdaftar.
 */
async function registerWebPluginInWorkspace(webRoot, name) {
    const packageJsonPath = path.join(webRoot, 'package.json');
    const pkg = await fs.readJson(packageJsonPath);

    const workspaces = pkg.workspaces || [];
    const hasPluginsGlob = workspaces.some(
        (w) => w === 'plugins/*' || w === `plugins/${name}-plugin`
    );

    if (hasPluginsGlob) {
        return false; // Sudah ada, tidak perlu update
    }

    // Tambahkan glob plugins/*
    pkg.workspaces = [...workspaces, 'plugins/*'];
    await fs.writeJson(packageJsonPath, pkg, { spaces: 2 });
    return true;
}

module.exports = { generateWebPlugin, registerWebPluginInWorkspace };
