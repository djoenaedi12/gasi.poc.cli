const _ = require('lodash');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');

const { renderTemplateTree } = require('../api-template-engine');
const { listPluginModules, registerInParentPom } = require('../maven-pom');
const { generateWebPlugin, registerWebPluginInWorkspace } = require('../web-plugin-generator');
const {
    validatePluginName,
    validatePackage,
    validateDomain,
    validatePluginDependency,
} = require('../validators');

async function pluginCreate(opts) {
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

    console.log(chalk.cyan.bold('\n  gasi — Plugin Generator\n'));

    // Tentukan target: api, web, atau all
    const target = (opts.target || 'all').toLowerCase();
    const doApi = target === 'api' || target === 'all';
    const doWeb = target === 'web' || target === 'all';

    // Validasi untuk API target: butuh pom.xml
    const parentPom = path.join(cwd, 'pom.xml');
    if (doApi && !(await fs.pathExists(parentPom))) {
        throw new Error(`No pom.xml found in ${cwd}. Run from the project root or use --cwd.`);
    }

    // Validasi untuk Web target: butuh package.json dengan workspaces
    if (doWeb) {
        const packageJson = path.join(cwd, 'package.json');
        if (!(await fs.pathExists(packageJson))) {
            throw new Error(`No package.json found in ${cwd}. Run from the monorepo root or use --cwd.`);
        }
        const pkg = await fs.readJson(packageJson);
        if (!pkg.workspaces) {
            throw new Error(`package.json has no "workspaces" field. Are you in the monorepo root?`);
        }
    }

    // Kumpulkan jawaban
    const answers = await collectAnswers(opts, parentPom, doApi);

    // Tampilkan summary
    const apiTargetDir = path.join(cwd, 'plugins', `${answers.name}-plugin`);
    const webTargetDir = path.join(cwd, 'plugins', `${answers.name}-plugin`);

    if (!opts.yes) {
        console.log('\n' + chalk.bold('Summary:'));
        console.log(`  Plugin name     : ${chalk.green(answers.name + '-plugin')}`);
        console.log(`  Target          : ${chalk.green(target)}`);
        if (doApi) {
            console.log(`  Domain          : ${chalk.green(answers.domain)}`);
            console.log(`  Base package    : ${chalk.green(answers.basePackage)}`);
            console.log(`  Full package    : ${chalk.green(answers.basePackage + '.' + answers.domain)}`);
            console.log(`  Flyway sample   : ${answers.flyway ? chalk.green('yes') : chalk.gray('no')}`);
            console.log(`  Auto-register   : ${answers.register ? chalk.green('yes') : chalk.gray('no')}`);
            console.log(`  Depends on      : ${answers.dependsOn.length ? chalk.green(answers.dependsOn.join(', ')) : chalk.gray('(none)')}`);
        }
        console.log(`  Version         : ${chalk.green(answers.version)}`);
        console.log(`  Description     : ${chalk.green(answers.description)}`);
        if (doWeb) {
            console.log(`  Web output      : ${chalk.gray(webTargetDir)}`);
        }
        if (doApi) {
            console.log(`  API output      : ${chalk.gray(apiTargetDir)}`);
        }
        console.log('');

        const { confirm } = await inquirer.prompt([
            { type: 'confirm', name: 'confirm', message: 'Continue?', default: true },
        ]);
        if (!confirm) {
            console.log(chalk.yellow('Cancelled.'));
            return;
        }
    }

    // === Generate API plugin ===
    if (doApi) {
        if (await fs.pathExists(apiTargetDir)) {
            throw new Error(`Target directory already exists: ${apiTargetDir}`);
        }

        const spinner = ora('Generating API plugin skeleton...').start();
        try {
            const templateRoot = path.join(__dirname, '..', '..', 'templates', 'api', 'plugin');
            const ctx = buildApiContext(answers);

            await renderTemplateTree(templateRoot, apiTargetDir, ctx, {
                includeFlyway: answers.flyway,
            });
            spinner.succeed('API plugin skeleton generated.');
        } catch (err) {
            spinner.fail('Failed to generate API plugin skeleton.');
            await fs.remove(apiTargetDir).catch(() => { });
            throw err;
        }

        // Auto-register di parent pom.xml
        if (answers.register) {
            const regSpinner = ora('Registering module in parent pom.xml...').start();
            try {
                const moduleName = `plugins/${answers.name}-plugin`;
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

    // === Generate Web plugin ===
    if (doWeb) {
        const spinner = ora('Generating web plugin skeleton...').start();
        try {
            await generateWebPlugin({
                webRoot: cwd,
                name: answers.name,
                version: answers.version,
                description: answers.description,
            });
            spinner.succeed('Web plugin skeleton generated.');
        } catch (err) {
            spinner.fail('Failed to generate web plugin skeleton.');
            if (!doApi) await fs.remove(webTargetDir).catch(() => { });
            throw err;
        }

        // Pastikan plugins/* ada di workspaces
        const wsSpinner = ora('Checking workspace registration...').start();
        try {
            const added = await registerWebPluginInWorkspace(cwd, answers.name);
            if (added) {
                wsSpinner.succeed(`'plugins/*' added to workspaces in package.json.`);
            } else {
                wsSpinner.info(`Plugin already covered by workspaces in package.json.`);
            }
        } catch (err) {
            wsSpinner.warn(`Could not update package.json: ${err.message}`);
        }
    }

    // Done — next steps
    console.log(chalk.green.bold('\n✓ Plugin created successfully!\n'));
    console.log(chalk.bold('Next steps:'));
    let step = 1;

    console.log(chalk.gray(`  ${step++}.`) + ` Review generated files: ${chalk.cyan(path.join(cwd, 'plugins', answers.name + '-plugin'))}`);

    if (doWeb) {
        console.log(chalk.gray(`  ${step++}.`) + ` Build web plugin: ${chalk.cyan(`npm run build -w plugins/${answers.name}-plugin`)}`);
        console.log(chalk.gray(`  ${step++}.`) + ` Deploy web plugin: ${chalk.cyan(`gasi plugin deploy ${answers.name} --target web`)}`);
        console.log(chalk.gray(`  ${step++}.`) + ` Add features with: ${chalk.cyan(`gasi resource create --target web --web-dir plugins/${answers.name}-plugin`)}`);
    }
    if (doApi) {
        console.log(chalk.gray(`  ${step++}.`) + ` Build API plugin: ${chalk.cyan(`gasi plugin build ${answers.name}`)}`);
        console.log(chalk.gray(`  ${step++}.`) + ` Deploy API plugin: ${chalk.cyan(`gasi plugin deploy ${answers.name}`)}`);
    }
    console.log('');
}

async function collectAnswers(opts, parentPomPath, doApi) {
    const flagDeps = (opts.dependsOn || []).map((s) => s.trim()).filter(Boolean);

    if (opts.yes) {
        const name = opts.name || 'sample';
        return {
            name: name.toLowerCase(),
            domain: (opts.domain || name).toLowerCase(),
            pluginPrefix: (opts.pluginPrefix || name).toLowerCase(),
            basePackage: opts.package || 'gasi.gps',
            version: opts.pluginVersion || '1.0.0',
            description: opts.description || `${_.upperFirst(name)} plugin`,
            dependsOn: flagDeps,
            flyway: opts.flyway !== false,
            register: opts.register !== false,
        };
    }

    const questions = [];

    if (!opts.name) {
        questions.push({
            type: 'input',
            name: 'name',
            message: 'Plugin name (without "-plugin" suffix, example: hr):',
            validate: validatePluginName,
            filter: (v) => v.trim().toLowerCase(),
        });
    }

    if (doApi && !opts.domain) {
        questions.push({
            type: 'input',
            name: 'domain',
            message: 'Java domain package name (example: hr):',
            default: (a) => a.name || opts.name,
            validate: validateDomain,
            filter: (v) => v.trim().toLowerCase(),
        });
    }

    if (doApi && !opts.pluginPrefix) {
        questions.push({
            type: 'input',
            name: 'pluginPrefix',
            message: 'Plugin prefix (optional, example: hr):',
            filter: (v) => (v || '').trim().toLowerCase(),
        });
    }

    if (doApi && !opts.package) {
        questions.push({
            type: 'input',
            name: 'basePackage',
            message: 'Base package:',
            default: 'gasi.gps',
            validate: validatePackage,
            filter: (v) => v.trim(),
        });
    }

    if (!opts.pluginVersion) {
        questions.push({
            type: 'input',
            name: 'version',
            message: 'Plugin version:',
            default: '1.0.0',
        });
    }

    if (!opts.description) {
        questions.push({
            type: 'input',
            name: 'description',
            message: 'Plugin description:',
            default: (a) => `${_.upperFirst(a.name || opts.name)} plugin`,
        });
    }

    const answers = await inquirer.prompt(questions);
    const interim = {
        name: opts.name || answers.name,
        domain: opts.domain || answers.domain || (opts.name || answers.name),
        pluginPrefix: opts.pluginPrefix || answers.pluginPrefix || '',
        basePackage: opts.package || answers.basePackage || 'gasi.gps',
        version: opts.pluginVersion || answers.version,
        description: opts.description || answers.description,
    };

    // Plugin dependency picker hanya untuk API
    let deps = [];
    if (doApi && parentPomPath) {
        deps = await promptPluginDependencies(parentPomPath, interim.name, flagDeps);
    }

    const raw = { ...interim, dependsOn: deps };

    // Validasi
    const checks = [['name', validatePluginName(raw.name)]];
    if (doApi) {
        checks.push(
            ['domain', validateDomain(raw.domain)],
            ['package', validatePackage(raw.basePackage)],
        );
    }
    for (const [field, result] of checks) {
        if (result !== true) throw new Error(`Invalid ${field}: ${result}`);
    }

    return {
        ...raw,
        flyway: opts.flyway !== false,
        register: opts.register !== false,
    };
}

async function promptPluginDependencies(parentPomPath, ownPluginName, preSelectedFlags) {
    let known = [];
    try {
        known = await listPluginModules(parentPomPath, `${ownPluginName}-plugin`);
    } catch (_) { }

    const preIds = new Set(preSelectedFlags.map((d) => dependencyId(d)));
    const result = [];

    if (known.length > 0) {
        const { selected } = await inquirer.prompt([{
            type: 'checkbox',
            name: 'selected',
            message: 'Plugin dependencies (select or skip):',
            choices: known.map((moduleName) => {
                const id = moduleToPluginId(moduleName);
                return { name: moduleName, value: id, checked: preIds.has(id) };
            }),
        }]);
        result.push(...selected);
    }

    for (const dep of preSelectedFlags) {
        const normalizedDep = normalizeDependency(dep);
        const baseId = dependencyId(normalizedDep);
        if (!result.includes(normalizedDep) && !result.includes(baseId)) result.push(normalizedDep);
    }

    const { addMore } = await inquirer.prompt([{
        type: 'confirm',
        name: 'addMore',
        message: 'Add dependencies manually?',
        default: false,
    }]);

    if (addMore) {
        let keepGoing = true;
        while (keepGoing) {
            const { entry } = await inquirer.prompt([{
                type: 'input',
                name: 'entry',
                message: 'Format: <plugin-id>[@<version>][?]. Leave empty to stop.',
                validate: (v) => { const t = (v || '').trim(); if (!t) return true; return validatePluginDependency(t); },
                filter: (v) => v.trim(),
            }]);
            if (!entry) keepGoing = false;
            else result.push(entry);
        }
    }

    return result;
}

function moduleToPluginId(moduleName) {
    return moduleName.split(/[\\/]/).pop();
}

function dependencyId(dependency) {
    return moduleToPluginId(dependency.replace(/[?@].*$/, ''));
}

function normalizeDependency(dependency) {
    const optional = dependency.endsWith('?') ? '?' : '';
    const core = optional ? dependency.slice(0, -1) : dependency;
    const atIdx = core.indexOf('@');

    if (atIdx === -1) {
        return `${moduleToPluginId(core)}${optional}`;
    }

    return `${moduleToPluginId(core.slice(0, atIdx))}${core.slice(atIdx)}${optional}`;
}

function buildApiContext(a) {
    const fullPackage = `${a.basePackage}.${a.domain}`;
    const pkgPath = a.basePackage.replace(/\./g, '/');
    const domainClassPrefix = _.upperFirst(_.camelCase(a.name));
    return {
        PLUGIN_NAME: a.name,
        PLUGIN_PREFIX: a.pluginPrefix,
        PLUGIN_ID: `${a.name}-plugin`,
        PLUGIN_VERSION: a.version,
        PLUGIN_DESCRIPTION: a.description,
        PLUGIN_DEPENDENCIES: a.dependsOn.join(', '),
        PLUGIN_CLASS_NAME: `${domainClassPrefix}Plugin`,
        EXTENSION_CLASS_NAME: `${domainClassPrefix}AppExtension`,
        FLYWAY_EXT_CLASS_NAME: `${domainClassPrefix}FlywayMigrationExtension`,
        I18N_EXT_CLASS_NAME: `${domainClassPrefix}I18nExtension`,
        DOMAIN: a.domain,
        DOMAIN_CAP: _.upperFirst(a.domain),
        BASE_PACKAGE: a.basePackage,
        FULL_PACKAGE: fullPackage,
        PKG_PATH: pkgPath,
        FLYWAY_LOCATION: `db/migration/${a.name}`,
        I18N_BASENAME: `classpath:i18n/${a.name}/messages`,
        MIGRATION_TIMESTAMP: nowTimestamp(),
    };
}

function nowTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear().toString() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

module.exports = pluginCreate;
