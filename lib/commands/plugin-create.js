const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');

const { renderTemplateTree } = require('../api-template-engine');
const { addGeneratedHeader } = require('../generated-header');
const { registerInParentPom } = require('../maven-pom');
const { generateWebPlugin, registerWebPluginInWorkspace } = require('../web-plugin-generator');
const { normalizePluginTarget } = require('../plugin-spec');

async function pluginCreate(opts) {
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
    const target = normalizePluginTarget(opts.target);
    const spec = opts.spec;

    if (!spec) {
        throw new Error('Plugin spec is required.');
    }

    console.log(chalk.cyan.bold('\n  gasi — Plugin Generator\n'));

    if (target === 'api') {
        await generateApiPlugin({ cwd, spec });
        printNextSteps({ cwd, spec, target });
        return;
    }

    await generateWebPluginTarget({ cwd, spec });
    printNextSteps({ cwd, spec, target });
}

async function generateApiPlugin({ cwd, spec }) {
    const parentPom = path.join(cwd, 'pom.xml');
    if (!(await fs.pathExists(parentPom))) {
        throw new Error(`No pom.xml found in ${cwd}. Run from the API project root or use --cwd.`);
    }

    const targetDir = path.join(cwd, 'plugins', `${spec.name}-plugin`);
    if (await fs.pathExists(targetDir)) {
        throw new Error(`Target directory already exists: ${targetDir}`);
    }

    const spinner = ora('Generating API plugin skeleton...').start();
    try {
        const templateRoot = path.join(__dirname, '..', '..', 'templates', 'api', 'plugin');
        const ctx = buildApiContext(spec);

        await renderTemplateTree(templateRoot, targetDir, ctx, {
            includeFlyway: false,
            transformContent: addGeneratedHeader,
        });
        if (spec.api.flyway) {
            await fs.ensureDir(path.join(targetDir, 'src', 'main', 'resources', 'db', 'migration', spec.name));
        }
        spinner.succeed('API plugin skeleton generated.');
    } catch (err) {
        spinner.fail('Failed to generate API plugin skeleton.');
        await fs.remove(targetDir).catch(() => { });
        throw err;
    }

    if (spec.api.register) {
        const regSpinner = ora('Registering module in parent pom.xml...').start();
        try {
            const moduleName = `plugins/${spec.name}-plugin`;
            const added = await registerInParentPom(parentPom, moduleName);
            if (added) {
                regSpinner.succeed(`Module '${moduleName}' added to pom.xml.`);
            } else {
                regSpinner.info(`Module '${moduleName}' is already registered in pom.xml.`);
            }
        } catch (err) {
            regSpinner.warn(`Failed to update pom.xml: ${err.message}. Add it manually.`);
        }
    }
}

async function generateWebPluginTarget({ cwd, spec }) {
    const packageJson = path.join(cwd, 'package.json');
    if (!(await fs.pathExists(packageJson))) {
        throw new Error(`No package.json found in ${cwd}. Run from the web project root or use --cwd.`);
    }

    const spinner = ora('Generating web plugin skeleton...').start();
    try {
        await generateWebPlugin({
            webRoot: cwd,
            name: spec.name,
            version: spec.version,
            description: spec.description,
        });
        spinner.succeed('Web plugin skeleton generated.');
    } catch (err) {
        spinner.fail('Failed to generate web plugin skeleton.');
        await fs.remove(path.join(cwd, 'plugins', `${spec.name}-plugin`)).catch(() => { });
        throw err;
    }

    const wsSpinner = ora('Checking workspace registration...').start();
    try {
        const added = await registerWebPluginInWorkspace(cwd, spec.name);
        if (added) {
            wsSpinner.succeed(`'plugins/*' added to workspaces in package.json.`);
        } else {
            wsSpinner.info(`Plugin already covered by workspaces in package.json.`);
        }
    } catch (err) {
        wsSpinner.warn(`Could not update package.json: ${err.message}`);
    }
}

function printNextSteps({ cwd, spec, target }) {
    const pluginPath = path.join(cwd, 'plugins', `${spec.name}-plugin`);

    console.log(chalk.green.bold('\n✓ Plugin synced successfully!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(chalk.gray('  1.') + ` Review generated files: ${chalk.cyan(pluginPath)}`);

    if (target === 'web') {
        console.log(chalk.gray('  2.') + ` Build web plugin: ${chalk.cyan(`npm run build -w plugins/${spec.name}-plugin`)}`);
        console.log(chalk.gray('  3.') + ` Deploy web plugin: ${chalk.cyan(`gasi plugin deploy ${spec.name} --target web`)}`);
        console.log(chalk.gray('  4.') + ` Add features with: ${chalk.cyan(`gasi resource sync --target web --plugin plugins/${spec.name}-plugin -f resource.json`)}`);
        console.log('');
        return;
    }

    console.log(chalk.gray('  2.') + ` Build API plugin: ${chalk.cyan(`gasi plugin build ${spec.name}`)}`);
    console.log(chalk.gray('  3.') + ` Deploy API plugin: ${chalk.cyan(`gasi plugin deploy ${spec.name}`)}`);
    console.log('');
}

function buildApiContext(spec) {
    const api = spec.api;
    const fullPackage = `${api.basePackage}.${api.domain}`;
    const pkgPath = api.basePackage.replace(/\./g, '/');
    const domainClassPrefix = _.upperFirst(_.camelCase(spec.name));
    return {
        PLUGIN_NAME: spec.name,
        PLUGIN_PREFIX: api.pluginPrefix,
        PLUGIN_ID: `${spec.name}-plugin`,
        PLUGIN_VERSION: spec.version,
        PLUGIN_DESCRIPTION: spec.description,
        PLUGIN_DEPENDENCIES: api.dependsOn.join(', '),
        PLUGIN_CLASS_NAME: `${domainClassPrefix}Plugin`,
        EXTENSION_CLASS_NAME: `${domainClassPrefix}AppExtension`,
        FLYWAY_EXT_CLASS_NAME: `${domainClassPrefix}FlywayMigrationExtension`,
        I18N_EXT_CLASS_NAME: `${domainClassPrefix}I18nExtension`,
        DOMAIN: api.domain,
        DOMAIN_CAP: _.upperFirst(api.domain),
        BASE_PACKAGE: api.basePackage,
        FULL_PACKAGE: fullPackage,
        PKG_PATH: pkgPath,
        FLYWAY_LOCATION: `db/migration/${spec.name}`,
        I18N_BASENAME: `classpath:i18n/${spec.name}/messages`,
        MIGRATION_TIMESTAMP: nowTimestamp(),
    };
}

function nowTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

module.exports = pluginCreate;
