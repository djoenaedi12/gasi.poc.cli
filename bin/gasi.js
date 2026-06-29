#!/usr/bin/env node
const { Command } = require('commander');
const chalk = require('chalk');
const pluginBuild = require('../lib/commands/plugin-build');
const pluginClean = require('../lib/commands/plugin-clean');
const pluginDelete = require('../lib/commands/plugin-delete');
const pluginDeploy = require('../lib/commands/plugin-deploy');
const pluginList = require('../lib/commands/plugin-list');
const pluginPlan = require('../lib/commands/plugin-plan');
const pluginSync = require('../lib/commands/plugin-sync');
const pluginValidate = require('../lib/commands/plugin-validate');
const resourceDelete = require('../lib/commands/resource-delete');
const resourcePlan = require('../lib/commands/resource-plan');
const resourceSync = require('../lib/commands/resource-sync');
const resourceValidate = require('../lib/commands/resource-validate');
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
    .command('validate')
    .description('Validate plugin definition JSON')
    .option('--cwd <path>', 'Root project directory (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('-f, --file <file>', 'Plugin definition file (JSON)')
    .action(async (opts) => {
        try { await pluginValidate(opts); } catch (err) { handleError(err); }
    });

plugin
    .command('plan')
    .description('Show plugin sync plan from JSON')
    .option('--cwd <path>', 'Root project directory (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('-f, --file <file>', 'Plugin definition file (JSON)')
    .action(async (opts) => {
        try { await pluginPlan(opts); } catch (err) { handleError(err); }
    });

plugin
    .command('sync')
    .description('Generate plugin skeleton from JSON')
    .option('--cwd <path>', 'Root project directory (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('-f, --file <file>', 'Plugin definition file (JSON)')
    .action(async (opts) => {
        try { await pluginSync(opts); } catch (err) { handleError(err); }
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
    .command('validate')
    .description('Validate resource definition JSON files')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .option('-f, --file <file>', 'Resource definition file (JSON). Can be repeated.', collect, [])
    .action(async (opts) => {
        try { await resourceValidate(opts); } catch (err) { handleError(err); }
    });

resource
    .command('plan')
    .description('Compare resource JSON files with the generated resource manifest')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('--plugin <module>', 'Target plugin module/path')
    .option('-f, --file <file>', 'Resource definition file (JSON). Can be repeated.', collect, [])
    .action(async (opts) => {
        try { await resourcePlan(opts); } catch (err) { handleError(err); }
    });

resource
    .command('sync')
    .description('Generate resources from JSON and skip unchanged resources')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('--plugin <module>', 'Target plugin module/path')
    .option('-f, --file <file>', 'Resource definition file (JSON). Can be repeated.', collect, [])
    .action(async (opts) => {
        try { await resourceSync(opts); } catch (err) { handleError(err); }
    });

resource
    .command('delete <entityName>')
    .description('Delete generated resource files listed in the target manifest')
    .option('--cwd <path>', 'Root project (default: cwd)')
    .requiredOption('--target <target>', 'Generator target: api or web')
    .requiredOption('--plugin <module>', 'Target plugin module/path')
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
