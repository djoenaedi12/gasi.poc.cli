const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

const {
    validatePluginName,
    validatePackage,
    validateDomain,
    validatePluginDependency,
} = require('./validators');

async function loadPluginSpecFile(filePath, cwd) {
    const absFile = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

    if (!(await fs.pathExists(absFile))) {
        throw new Error(`Plugin definition file not found: ${absFile}`);
    }

    let spec;
    try {
        spec = await fs.readJson(absFile);
    } catch (err) {
        throw new Error(`Invalid JSON file: ${absFile}. ${err.message}`);
    }

    return {
        file: absFile,
        spec,
    };
}

function normalizePluginSpecDocument(spec, target, sourceLabel) {
    const normalizedTarget = normalizePluginTarget(target);

    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error(`${sourceLabel} must be a JSON object.`);
    }

    const name = normalizeString(spec.name);
    assertValid('name', validatePluginName(name), sourceLabel);

    const version = normalizeString(spec.version) || '1.0.0';
    const description = normalizeString(spec.description) || `${_.upperFirst(name)} plugin`;

    const api = spec.api && typeof spec.api === 'object' && !Array.isArray(spec.api)
        ? spec.api
        : {};
    const web = spec.web && typeof spec.web === 'object' && !Array.isArray(spec.web)
        ? spec.web
        : {};

    const normalized = {
        name,
        version,
        description,
        target: normalizedTarget,
        sourceFile: sourceLabel,
    };

    if (normalizedTarget === 'api') {
        const domain = normalizeString(api.domain ?? spec.domain) || name.replace(/-/g, '');
        const basePackage = normalizeString(api.package ?? api.basePackage ?? spec.package ?? spec.basePackage) || 'gasi.gps';
        const pluginPrefix = normalizeString(api.pluginPrefix ?? spec.pluginPrefix) || name;
        const dependsOn = normalizeDependsOn(api.dependsOn ?? spec.dependsOn);

        assertValid('api.domain', validateDomain(domain), sourceLabel);
        assertValid('api.package', validatePackage(basePackage), sourceLabel);
        for (const dependency of dependsOn) {
            assertValid(`api.dependsOn "${dependency}"`, validatePluginDependency(dependency), sourceLabel);
        }

        normalized.api = {
            domain,
            basePackage,
            pluginPrefix,
            dependsOn,
            flyway: (api.flyway ?? spec.flyway) !== false,
            register: (api.register ?? spec.register) !== false,
        };
    }

    if (normalizedTarget === 'web') {
        normalized.web = {
            displayName: normalizeString(web.displayName) || _.startCase(name),
        };
    }

    return normalized;
}

function normalizePluginTarget(target) {
    const normalized = String(target || '').toLowerCase();
    const aliases = {
        be: 'api',
        backend: 'api',
        fe: 'web',
        frontend: 'web',
    };
    const resolved = aliases[normalized] || normalized;

    if (!['api', 'web'].includes(resolved)) {
        throw new Error(`Invalid --target "${target}". Allowed: api, web.`);
    }

    return resolved;
}

function normalizeDependsOn(value) {
    if (value === undefined || value === null) {
        return [];
    }

    if (!Array.isArray(value)) {
        throw new Error('api.dependsOn must be an array.');
    }

    return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function assertValid(field, result, sourceLabel) {
    if (result !== true) {
        throw new Error(`${sourceLabel}.${field} is invalid: ${result}`);
    }
}

module.exports = {
    loadPluginSpecFile,
    normalizePluginSpecDocument,
    normalizePluginTarget,
};
