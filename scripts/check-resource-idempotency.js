const assert = require('assert');

const { hashResourceSpec } = require('../lib/generated-manifest');

const base = {
    entityName: 'Employee',
    sourceFile: '/tmp/employee.json',
    fields: [
        {
            name: 'employeeNo',
            type: 'String',
            required: true,
            length: 32,
        },
    ],
};

const reordered = {
    fields: [
        {
            length: 32,
            required: true,
            type: 'String',
            name: 'employeeNo',
        },
    ],
    sourceFile: '/another/path/employee.json',
    entityName: 'Employee',
};

const changed = {
    ...base,
    fields: [
        {
            ...base.fields[0],
            length: 64,
        },
    ],
};

assert.strictEqual(hashResourceSpec(base), hashResourceSpec(reordered));
assert.notStrictEqual(hashResourceSpec(base), hashResourceSpec(changed));

console.log('resource idempotency check passed');
