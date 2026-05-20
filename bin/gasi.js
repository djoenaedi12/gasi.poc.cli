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
    .description('GASI developer toolkit — scaffolding & dev tools for modular application')
    .version(pkg.version);

const plugin = program
    .command('plugin')
    .description('Manage plugin scaffolding, build, and runtime deployment lifecycle');

plugin
    .command('create')
    .description('Generate a new plugin skeleton')
    .option('-n, --name <name>', 'Plugin name (example: hr)')
    .option('-t, --target <target>', 'Generator target: api, web, or all (default: all)', 'all')
    .option('--plugin-prefix <prefix>', 'Optional plugin table prefix (API only)')
    .option('-d, --domain <domain>', 'Java domain package name (API only)')
    .option('-p, --package <package>', 'Base package (API only, default: gasi.gps)')
    .option('-v, --plugin-version <version>', 'Plugin version (default: 1.0.0)')
    .option('--description <desc>', 'Plugin description')
    .option(
        '--depends-on <dep>',
        'Plugin dependency (API only). Can be repeated.',
        (val, prev) => prev.concat(val.split(',').map((s) => s.trim()).filter(Boolean)),
        [],
    )
    .option('--no-flyway', 'Skip Flyway migration sample (API only)')
    .option('--no-register', 'Skip auto-register in parent pom.xml (API only)')
    .option('-y, --yes', 'Skip interactive prompts and use defaults')
    .option('--cwd <path>', 'Root project directory (default: cwd)')
    .action(async (opts) => {
        try { await pluginCreate(opts); } catch (err) { handleError(err); }
    });

plugin
    .command('list')
    .description('List plugin modules registered in the parent pom.xml')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .action(async (opts) => {
        try { await pluginList(opts); } catch (err) { handleError(err); }
    });

plugin
    .command('build <name>')
    .description('Build a plugin')
    .option('-t, --target <target>', 'Build target: api, web, or all (default: api)', 'api')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--skip-tests', 'Skip tests during Maven build (API only)')
    .option('--profile <name>', 'Maven profile to activate (API only)')
    .option('--dry-run', 'Print commands without running them')
    .option('--verbose', 'Show full Maven output (API only)')
    .action(async (name, opts) => {
        try { await pluginBuild(name, opts); } catch (err) { handleError(err); }
    });

plugin
    .command('deploy <name>')
    .description('Deploy a built plugin to the platform')
    .option('-t, --target <target>', 'Deploy target: api, web, or all (default: api)', 'api')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--plugins-dir <path>', 'Override plugin deployment directory')
    .option('--keep-old', 'Keep older deployed JARs (API only)')
    .option('--keep-deployed', 'Skip removing deployed files on delete')
    .option('--dry-run', 'Print deploy actions without changing files')
    .action(async (name, opts) => {
        try { await pluginDeploy(name, opts); } catch (err) { handleError(err); }
    });

plugin
    .command('clean <name>')
    .description('Remove deployed plugin files from the platform')
    .option('-t, --target <target>', 'Clean target: api, web, or all (default: api)', 'api')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--plugins-dir <path>', 'Override plugin deployment directory')
    .option('--dry-run', 'Print clean actions without changing files')
    .action(async (name, opts) => {
        try { await pluginClean(name, opts); } catch (err) { handleError(err); }
    });

plugin
    .command('delete <name>')
    .description('Delete a plugin and remove its deployed files')
    .option('-t, --target <target>', 'Delete target: api, web, or all (default: api)', 'api')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--plugins-dir <path>', 'Override plugin deployment directory')
    .option('--keep-deployed', 'Keep deployed files when deleting')
    .option('--dry-run', 'Print delete actions without changing files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (name, opts) => {
        try { await pluginDelete(name, opts); } catch (err) { handleError(err); }
    });

const resource = program
    .command('resource')
    .description('Manage resource scaffolding');

resource
    .command('create [entityName]')
    .description('Generate a full CRUD resource inside an existing plugin')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--target <target>', 'Generator target: api, web, or all (default: api)', 'api')
    .option('--web-dir <path>', 'Frontend plugin root for --target web/all')
    .option('--web-force', 'Overwrite existing generated web files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('-f, --file <file>', 'Resource definition file (JSON). Can be repeated.', collect, [])
    .action(async (entityName, opts) => {
        try { await resourceCreate(entityName, opts); } catch (err) { handleError(err); }
    });

resource
    .command('delete <entityName>')
    .description('Delete all generated resource files for an entity')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--include-migration', 'Also delete Flyway migration SQL files')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (entityName, opts) => {
        try { await resourceDelete(entityName, opts); } catch (err) { handleError(err); }
    });

const uploader = program
    .command('uploader')
    .description('Manage data upload processor scaffolding');

uploader
    .command('create <name>')
    .description('Generate a DataUplProcessor inside an existing plugin')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('--plugin <name>', 'Target plugin name')
    .option('--resource <name>', 'Upload API resource name')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (name, opts) => {
        try { await uploaderCreate(name, opts); } catch (err) { handleError(err); }
    });

function handleError(err) {
    console.error(chalk.red('\n✗ Error: ') + err.message);
    if (process.env.GASI_DEBUG) console.error(err.stack);
    process.exit(1);
}

function collect(value, previous) {
    return previous.concat([value]);
}

program.parseAsync(process.argv).catch((err) => {
    console.error(chalk.red(err.message));
    process.exit(1);
});
