const path = require('path');
const chalk = require('chalk');

const { resolveCwd } = require('../plugin-utils');
const {
    loadResourceSpecFile,
    normalizeResourceSpecDocument,
    assertUniqueEntityNames,
} = require('../resource-spec');

async function resourceValidate(opts) {
    const cwd = resolveCwd(opts);
    const filePaths = normalizeFileOptions(opts.file);

    if (!filePaths.length) {
        throw new Error('At least one -f, --file <file> is required.');
    }

    const resources = await loadResourceSpecs(filePaths, cwd);

    console.log(chalk.green.bold('\n✓ Resource JSON is valid\n'));
    console.log(`  Files     : ${chalk.green(filePaths.length)}`);
    console.log(`  Resources : ${chalk.green(resources.length)}`);

    for (const resource of resources) {
        console.log(chalk.gray(`    - ${resource.entityName} (${path.relative(cwd, resource.sourceFile)})`));
    }

    console.log();
}

async function loadResourceSpecs(filePaths, cwd) {
    const resources = [];

    for (const filePath of filePaths) {
        const loaded = await loadResourceSpecFile(filePath, cwd);
        const sourceLabel = path.relative(cwd, loaded.file);
        const normalized = normalizeResourceSpecDocument(loaded.spec, null, sourceLabel);

        for (const resource of normalized) {
            resources.push({
                ...resource,
                sourceFile: loaded.file,
            });
        }
    }

    assertUniqueEntityNames(resources, 'resource files');
    return resources;
}

function normalizeFileOptions(fileOption) {
    if (!fileOption) {
        return [];
    }

    if (Array.isArray(fileOption)) {
        return fileOption.filter(Boolean);
    }

    return [fileOption];
}

module.exports = resourceValidate;
