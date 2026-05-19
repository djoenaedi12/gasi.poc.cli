const fs = require('fs-extra');

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function readPom(pomPath) {
    if (!(await fs.pathExists(pomPath))) {
        throw new Error(`pom.xml not found: ${pomPath}`);
    }

    return fs.readFile(pomPath, 'utf8');
}

async function writePom(pomPath, content) {
    await fs.writeFile(pomPath, content, 'utf8');
}

function findXmlBlock(content, tagName) {
    const pattern = new RegExp(`<${escapeRegex(tagName)}>([\\s\\S]*?)</${escapeRegex(tagName)}>`);
    const match = content.match(pattern);

    if (!match) {
        return null;
    }

    return {
        full: match[0],
        inner: match[1],
        start: match.index,
        end: match.index + match[0].length,
    };
}

function replaceXmlBlock(content, tagName, innerContent) {
    const block = findXmlBlock(content, tagName);
    if (!block) {
        throw new Error(`Could not find a <${tagName}> block in pom.xml.`);
    }

    return [
        content.slice(0, block.start),
        `<${tagName}>${innerContent}</${tagName}>`,
        content.slice(block.end),
    ].join('');
}

function detectChildIndent(blockContent, childTagName, fallback = '\n        ') {
    const pattern = new RegExp(`(\\s*)<${escapeRegex(childTagName)}(?:\\s|>)`);
    const match = blockContent.match(pattern);
    return match ? match[1] : fallback;
}

function parsePomModules(pomContent) {
    const modulesBlock = findXmlBlock(pomContent, 'modules');
    if (!modulesBlock) {
        return [];
    }

    const modules = [];
    const moduleRegex = /<module>\s*([^<]+?)\s*<\/module>/g;
    let match;

    while ((match = moduleRegex.exec(modulesBlock.inner)) !== null) {
        modules.push(match[1].trim());
    }

    return modules;
}

async function listPomModules(pomPath, options = {}) {
    const content = await readPom(pomPath);
    const modules = parsePomModules(content);
    const { excludeName, filter } = options;

    return modules.filter((moduleName) => {
        if (excludeName && moduleName === excludeName) {
            return false;
        }

        return filter ? filter(moduleName) : true;
    });
}

async function listPluginModules(pomPath, excludeName = null) {
    return listPomModules(pomPath, {
        excludeName,
        filter: (moduleName) => moduleName.endsWith('-plugin'),
    });
}

async function registerInParentPom(pomPath, moduleName) {
    const content = await readPom(pomPath);
    const modulesBlock = findXmlBlock(content, 'modules');

    if (!modulesBlock) {
        throw new Error('Could not find a <modules> block in pom.xml. Is this a multi-module parent POM?');
    }

    const moduleRegex = new RegExp(`<module>\\s*${escapeRegex(moduleName)}\\s*</module>`);
    if (moduleRegex.test(modulesBlock.inner)) {
        return false;
    }

    const indent = detectChildIndent(modulesBlock.inner, 'module');
    const newEntry = `${indent}<module>${moduleName}</module>`;
    const updatedModulesBlock = modulesBlock.inner.replace(/(\s*)$/, `${newEntry}$1`);
    const updatedContent = replaceXmlBlock(content, 'modules', updatedModulesBlock);

    await writePom(pomPath, updatedContent);
    return true;
}

async function unregisterFromParentPom(pomPath, moduleName) {
    const content = await readPom(pomPath);
    const modulesBlock = findXmlBlock(content, 'modules');

    if (!modulesBlock) {
        throw new Error('Could not find a <modules> block in pom.xml. Is this a multi-module parent POM?');
    }

    const moduleLineRegex = new RegExp(`\\n[ \\t]*<module>\\s*${escapeRegex(moduleName)}\\s*</module>`, 'm');
    if (!moduleLineRegex.test(modulesBlock.inner)) {
        return false;
    }

    const updatedModulesBlock = modulesBlock.inner.replace(moduleLineRegex, '');
    const updatedContent = replaceXmlBlock(content, 'modules', updatedModulesBlock);

    await writePom(pomPath, updatedContent);
    return true;
}

function buildDependencyXml(dependency) {
    return [
        '        <dependency>',
        `            <groupId>${dependency.groupId}</groupId>`,
        `            <artifactId>${dependency.artifactId}</artifactId>`,
        dependency.version ? `            <version>${dependency.version}</version>` : null,
        dependency.scope ? `            <scope>${dependency.scope}</scope>` : null,
        '        </dependency>',
    ].filter(Boolean).join('\n');
}

function hasDependency(pomContent, dependency) {
    const dependencyRegex = new RegExp(
        `<dependency>\\s*` +
        `<groupId>${escapeRegex(dependency.groupId)}</groupId>\\s*` +
        `<artifactId>${escapeRegex(dependency.artifactId)}</artifactId>` +
        `[\\s\\S]*?` +
        `</dependency>`,
        'm'
    );

    return dependencyRegex.test(pomContent);
}

async function ensurePomDependencies(pomPath, dependencies) {
    let pomContent = await readPom(pomPath);

    const missingDependencies = dependencies.filter((dependency) => {
        return !hasDependency(pomContent, dependency);
    });

    if (missingDependencies.length === 0) {
        return false;
    }

    const dependencyXml = missingDependencies
        .map(buildDependencyXml)
        .join('\n');

    if (pomContent.includes('</dependencies>')) {
        pomContent = pomContent.replace(
            '</dependencies>',
            `${dependencyXml}\n    </dependencies>`
        );
    } else {
        pomContent = pomContent.replace(
            '</project>',
            `    <dependencies>\n${dependencyXml}\n    </dependencies>\n</project>`
        );
    }

    await writePom(pomPath, pomContent);
    return true;
}

module.exports = {
    buildDependencyXml,
    detectChildIndent,
    ensurePomDependencies,
    escapeRegex,
    findXmlBlock,
    hasDependency,
    listPluginModules,
    listPomModules,
    parsePomModules,
    readPom,
    registerInParentPom,
    replaceXmlBlock,
    unregisterFromParentPom,
    writePom,
};
