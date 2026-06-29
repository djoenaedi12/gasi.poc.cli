const resourceCreate = require('./resource-create');

async function resourceSync(opts) {
    if (!opts.file || (Array.isArray(opts.file) && opts.file.length === 0)) {
        throw new Error('At least one -f, --file <file> is required.');
    }

    const target = String(opts.target || '').toLowerCase();
    if (!target) {
        throw new Error('--target is required. Allowed: api, web.');
    }

    if (!['api', 'web'].includes(target)) {
        throw new Error('resource sync supports --target api or --target web.');
    }

    await resourceCreate(null, {
        ...opts,
        target,
        sync: true,
        yes: true,
    });
}

module.exports = resourceSync;
