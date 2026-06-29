const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');

const API_MANIFEST_RELATIVE_PATH = path.join('.gasi', 'generated-api-resources.json');
const WEB_MANIFEST_RELATIVE_PATH = path.join('.gasi', 'generated-web-resources.json');
const MANIFEST_VERSION = 1;

function manifestRelativePath(target = 'api') {
    return target === 'web'
        ? WEB_MANIFEST_RELATIVE_PATH
        : API_MANIFEST_RELATIVE_PATH;
}

function manifestPath(cwd, target = 'api') {
    return path.join(cwd, manifestRelativePath(target));
}

async function loadGeneratedManifest(cwd, target = 'api') {
    const file = manifestPath(cwd, target);

    if (!(await fs.pathExists(file))) {
        return emptyManifest();
    }

    const manifest = await fs.readJson(file);
    return {
        ...emptyManifest(),
        ...manifest,
        resources: manifest.resources && typeof manifest.resources === 'object'
            ? manifest.resources
            : {},
    };
}

async function saveGeneratedManifest(cwd, manifest, target = 'api') {
    const file = manifestPath(cwd, target);
    const nextManifest = {
        ...emptyManifest(),
        ...manifest,
        updatedAt: new Date().toISOString(),
    };

    await fs.ensureDir(path.dirname(file));
    await fs.writeJson(file, nextManifest, { spaces: 2 });
}

async function recordGeneratedResource({ cwd, pluginModule, resource, generatedFiles, target = 'api' }) {
    const manifest = await loadGeneratedManifest(cwd, target);
    const key = resourceKey(pluginModule, resource.entityName);

    manifest.resources[key] = {
        target,
        entityName: resource.entityName,
        pluginModule,
        sourceFile: resource.sourceFile ? path.relative(cwd, resource.sourceFile) : null,
        specHash: hashResourceSpec(resource),
        generatedFiles: generatedFiles.map((file) => path.relative(cwd, file)).sort(),
        updatedAt: new Date().toISOString(),
    };

    await saveGeneratedManifest(cwd, manifest, target);
}

async function removeGeneratedResource({ cwd, pluginModule, entityName, target = 'api' }) {
    const manifest = await loadGeneratedManifest(cwd, target);
    const key = resourceKey(pluginModule, entityName);
    const record = manifest.resources[key] || null;

    if (record) {
        delete manifest.resources[key];
        await saveGeneratedManifest(cwd, manifest, target);
    }

    return record;
}

function getGeneratedResource(manifest, pluginModule, entityName) {
    return manifest.resources[resourceKey(pluginModule, entityName)] || null;
}

function hashResourceSpec(resource) {
    const normalized = stripVolatileKeys(resource);
    return crypto
        .createHash('sha256')
        .update(stableStringify(normalized))
        .digest('hex');
}

function resourceKey(pluginModule, entityName) {
    return `${pluginModule}:${entityName}`;
}

function emptyManifest() {
    return {
        version: MANIFEST_VERSION,
        generatedBy: 'gasi-cli',
        resources: {},
    };
}

function stripVolatileKeys(value) {
    if (Array.isArray(value)) {
        return value.map(stripVolatileKeys);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const out = {};
    for (const key of Object.keys(value).sort()) {
        if (key === 'sourceFile') continue;
        out[key] = stripVolatileKeys(value[key]);
    }
    return out;
}

function stableStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }

    if (!value || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    return `{${Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${stableStringify(value[key])}`,
    ).join(',')}}`;
}

module.exports = {
    API_MANIFEST_RELATIVE_PATH,
    WEB_MANIFEST_RELATIVE_PATH,
    manifestRelativePath,
    loadGeneratedManifest,
    saveGeneratedManifest,
    recordGeneratedResource,
    removeGeneratedResource,
    getGeneratedResource,
    hashResourceSpec,
};
