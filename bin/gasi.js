#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const pluginCreate = require('../lib/commands/plugin-create');
const pluginBuild = require('../lib/commands/plugin-build');
const pluginClean = require('../lib/commands/plugin-clean');
const pluginDelete = require('../lib/commands/plugin-delete');
const pluginDeploy = require('../lib/commands/plugin-deploy');
const pluginList = require('../lib/commands/plugin-list');
const resourceCreate = require('../lib/commands/resource-create');
const resourceDelete = require('../lib/commands/resource-delete');
const uploaderCreate = require('../lib/commands/uploader-create');
const pkg = require('../package.json');

const program = new Command();

program
    .name('gasi')
    .description('GASI developer toolkit — scaffolding & dev tools for modular Spring Boot + PF4J application')
    .version(pkg.version);

const plugin = program
    .command('plugin')
    .description('Manage plugin scaffolding, build, and runtime deployment lifecycle');

plugin
    .command('create')
    .description('Generate a new plugin skeleton following the project conventions')
    .option('-n, --name <name>', 'Plugin name (example: payroll)')
    .option('--plugin-prefix <prefix>', 'Optional plugin table prefix, example: auth')
    .option('-d, --domain <domain>', 'Java domain package name (example: payroll)')
    .option('-p, --package <package>', 'Base package (default: gasi.gps)')
    .option('-v, --plugin-version <version>', 'Plugin version (default: 1.0.0)')
    .option('--description <desc>', 'Plugin description')
    .option(
        '--depends-on <dep>',
        'Plugin dependency (format: id[@version-constraint][?]). Can be repeated.',
        (val, prev) => prev.concat(val.split(',').map((s) => s.trim()).filter(Boolean)),
        [],
    )
    .option('--no-flyway', 'Skip generating the Flyway migration sample')
    .option('--no-register', 'Skip auto-register in parent pom.xml')
    .option('-y, --yes', 'Skip interactive prompts and use defaults')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .action(async (opts) => {
        try {
            await pluginCreate(opts);
        } catch (err) {
            handleError(err);
        }
    });

plugin
    .command('list')
    .description('List plugin modules registered in the parent pom.xml')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .action(async (opts) => {
        try {
            await pluginList(opts);
        } catch (err) {
            handleError(err);
        }
    });

plugin
    .command('build <name>')
    .description('Build a plugin module with Maven')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--skip-tests', 'Skip tests during Maven build')
    .option('--profile <name>', 'Maven profile to activate')
    .option('--dry-run', 'Print the Maven command without running it')
    .option('--verbose', 'Show full Maven output')
    .action(async (name, opts) => {
        try {
            await pluginBuild(name, opts);
        } catch (err) {
            handleError(err);
        }
    });

plugin
    .command('deploy <name>')
    .description('Copy a built plugin JAR into the platform plugins directory')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--plugins-dir <path>', 'Plugin deployment directory (default: platform-app/plugins)')
    .option('--keep-old', 'Keep older deployed JARs for this plugin')
    .option('--dry-run', 'Print deploy actions without changing files')
    .action(async (name, opts) => {
        try {
            await pluginDeploy(name, opts);
        } catch (err) {
            handleError(err);
        }
    });

plugin
    .command('clean <name>')
    .description('Remove deployed plugin JARs from the platform plugins directory')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--plugins-dir <path>', 'Plugin deployment directory (default: platform-app/plugins)')
    .option('--dry-run', 'Print clean actions without changing files')
    .action(async (name, opts) => {
        try {
            await pluginClean(name, opts);
        } catch (err) {
            handleError(err);
        }
    });

plugin
    .command('delete <name>')
    .description('Delete a plugin module and unregister it from the parent pom.xml')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--plugins-dir <path>', 'Plugin deployment directory (default: platform-app/plugins)')
    .option('--keep-deployed', 'Keep deployed JARs in the plugins directory')
    .option('--dry-run', 'Print delete actions without changing files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (name, opts) => {
        try {
            await pluginDelete(name, opts);
        } catch (err) {
            handleError(err);
        }
    });

function handleError(err) {
    console.error(chalk.red('\n✗ Error: ') + err.message);
    if (process.env.GASI_DEBUG) console.error(err.stack);
    process.exit(1);
}

function collect(value, previous) {
    return previous.concat([value]);
}

const resource = program
    .command('resource')
    .description('Manage resource scaffolding (entity, service, controller, etc.)');

resource
    .command('create [entityName]')
    .description('Generate a full CRUD resource (all Clean Architecture layers) inside an existing plugin')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--target <target>', 'Generator target: api, web, or all (default: api)', 'api')
    .option('--web-dir <path>', 'Frontend project root for --target web/all')
    .option('--web-force', 'Overwrite existing generated web files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-f, --file <file>', 'resource definition file, JSON format. Can be used multiple times.', collect, [])
    .action(async (entityName, opts) => {
        try {
            await resourceCreate(entityName, opts);
        } catch (err) {
            handleError(err);
        }
    });

resource
    .command('delete <entityName>')
    .description('Delete all generated resource files for an entity from an existing plugin')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--include-migration', 'Also delete Flyway migration SQL files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (entityName, opts) => {
        try {
            await resourceDelete(entityName, opts);
        } catch (err) {
            handleError(err);
        }
    });

const uploader = program
    .command('uploader')
    .description('Manage data upload processor scaffolding');

uploader
    .command('create <name>')
    .description('Generate a resource-specific DataUplProcessor inside an existing plugin')
    .option('--cwd <path>', 'Root project (default: current working directory)')
    .option('--plugin <name>', 'Target plugin name, example: employee or employee-plugin')
    .option('--resource <name>', 'Upload API resource name (default: kebab-case of name)')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (name, opts) => {
        try {
            await uploaderCreate(name, opts);
        } catch (err) {
            handleError(err);
        }
    });

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red(err.message));
    process.exit(1);
});
