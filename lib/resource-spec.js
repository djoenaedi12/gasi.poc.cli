const _ = require('lodash');
const pluralize = require('pluralize');
const path = require('path');
const fs = require('fs-extra');

const { validateEntityName, validateFieldName, validateEnumName } = require('./validators');

const FIELD_TYPES = [
    { name: 'String', value: 'String' },
    { name: 'Text', value: 'Text' },
    { name: 'MediumText', value: 'MediumText' },
    { name: 'Integer', value: 'Integer' },
    { name: 'Long', value: 'Long' },
    { name: 'BigDecimal', value: 'BigDecimal' },
    { name: 'Double', value: 'Double' },
    { name: 'Boolean', value: 'Boolean' },
    { name: 'Date', value: 'Date' },
    { name: 'DateTime', value: 'DateTime' },
    { name: 'Instant', value: 'Instant' },
    { name: 'Enum', value: 'Enum' },
    { name: 'ManyToOne', value: 'ManyToOne' },
];

const FIELD_TYPE_VALUES = new Set(FIELD_TYPES.map((t) => t.value));
const DTO_KEYS = ['create', 'update', 'summary', 'detail'];
const STRING_TYPES = new Set(['String', 'Text', 'MediumText']);
const INTEGER_TYPES = new Set(['Integer', 'Long']);
const DECIMAL_TYPES = new Set(['BigDecimal', 'Double']);
const DATE_TYPES = new Set(['Date', 'DateTime', 'Instant']);

async function loadResourceSpecFile(filePath, cwd) {
    const absFile = path.isAbsolute(filePath)
        ? filePath
        : path.join(cwd, filePath);

    if (!(await fs.pathExists(absFile))) {
        throw new Error(`Resource definition file not found: ${absFile}`);
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

function normalizeResourceSpecDocument(spec, fallbackEntityName, sourceLabel) {
    if (Array.isArray(spec)) {
        if (spec.length === 0) {
            throw new Error(`${sourceLabel} must not be an empty array.`);
        }

        const resources = spec.map((item, index) =>
            validateSingleResourceSpec(item, null, `${sourceLabel}[${index}]`),
        );

        assertUniqueEntityNames(resources, sourceLabel);
        return resources;
    }

    if (!spec || typeof spec !== 'object') {
        throw new Error(`${sourceLabel} must be a JSON object or array.`);
    }

    if (Array.isArray(spec.resources)) {
        if (spec.resources.length === 0) {
            throw new Error(`${sourceLabel}.resources must be a non-empty array.`);
        }

        const resources = spec.resources.map((item, index) =>
            validateSingleResourceSpec(item, null, `${sourceLabel}.resources[${index}]`),
        );

        assertUniqueEntityNames(resources, sourceLabel);
        return resources;
    }

    return [
        validateSingleResourceSpec(spec, fallbackEntityName, sourceLabel),
    ];
}

function validateSingleResourceSpec(spec, fallbackEntityName, label) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
        throw new Error(`${label} must be a JSON object.`);
    }

    const finalEntityName = spec.entityName || fallbackEntityName;

    if (!finalEntityName) {
        throw new Error(`${label}.entityName is required.`);
    }

    const entityResult = validateEntityName(finalEntityName);
    if (entityResult !== true) {
        throw new Error(`${label}.entityName is invalid: ${entityResult}`);
    }

    if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
        throw new Error(`${label}.fields must be a non-empty array.`);
    }

    const existingNames = new Set();
    const fields = [];

    for (let i = 0; i < spec.fields.length; i++) {
        const raw = spec.fields[i];
        const fieldLabel = `${label}.fields[${i}]`;

        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error(`${fieldLabel} must be a JSON object.`);
        }

        const field = {
            name: raw.name,
            type: raw.type,
            required: raw.required !== undefined ? Boolean(raw.required) : true,
            unique: raw.unique !== undefined ? Boolean(raw.unique) : false,
            filterable: raw.filterable !== undefined ? Boolean(raw.filterable) : false,
        };

        const nameResult = validateFieldName(field.name);
        if (nameResult !== true) {
            throw new Error(`${fieldLabel}.name is invalid: ${nameResult}`);
        }

        if (existingNames.has(field.name)) {
            throw new Error(`${fieldLabel}.name is duplicated: ${field.name}`);
        }

        existingNames.add(field.name);

        if (!FIELD_TYPE_VALUES.has(field.type)) {
            throw new Error(`${fieldLabel}.type is invalid: ${field.type}. Allowed: ${Array.from(FIELD_TYPE_VALUES).join(', ')}`);
        }

        if (field.type === 'String') {
            const length = raw.length !== undefined ? parseInt(raw.length, 10) : 255;

            if (!Number.isInteger(length) || length <= 0) {
                throw new Error(`${fieldLabel}.length must be a positive number.`);
            }

            field.length = length;
        }

        if (field.type === 'ManyToOne') {
            if (!raw.refEntity) {
                throw new Error(`${fieldLabel}.refEntity is required for ManyToOne field.`);
            }

            const refResult = validateEntityName(raw.refEntity);
            if (refResult !== true) {
                throw new Error(`${fieldLabel}.refEntity is invalid: ${refResult}`);
            }

            field.refEntity = raw.refEntity;
        }

        if (field.type === 'Enum') {
            if (!raw.enumName) {
                throw new Error(`${fieldLabel}.enumName is required for Enum field.`);
            }

            const enumResult = validateEnumName(raw.enumName);
            if (enumResult !== true) {
                throw new Error(`${fieldLabel}.enumName is invalid: ${enumResult}`);
            }

            field.enumName = raw.enumName;
        }

        if (field.unique && !['String', 'Integer', 'Long'].includes(field.type)) {
            throw new Error(`${fieldLabel}.unique is only supported for String, Integer, or Long.`);
        }

        field.dto = normalizeDtoConfig(raw.dto, `${fieldLabel}.dto`);
        field.validation = normalizeValidationConfig(raw.validation, field, `${fieldLabel}.validation`);

        fields.push(field);
    }

    const parent = normalizeParentConfig(spec.parent, `${label}.parent`);
    const explicitAs = normalizeAsConfig(spec.as, `${label}.as`);
    const as = explicitAs || (parent ? pluralize(_.lowerFirst(finalEntityName)) : null);
    const exposeApi = spec.exposeApi !== undefined
        ? Boolean(spec.exposeApi)
        : parent ? false : true;

    if (parent) {
        const parentFieldName = _.lowerFirst(parent);
        const existingParentField = fields.find((field) => field.name === parentFieldName);

        if (existingParentField && (existingParentField.type !== 'ManyToOne' || existingParentField.refEntity !== parent)) {
            throw new Error(`${label}.parent conflicts with field "${parentFieldName}". Parent field must be ManyToOne to ${parent}.`);
        }
    }

    return {
        entityName: finalEntityName,
        parent,
        as,
        exposeApi,
        fields,
    };
}

function normalizeParentConfig(parent, label) {
    if (parent === undefined || parent === null || parent === '') {
        return null;
    }

    if (typeof parent !== 'string') {
        throw new Error(`${label} must be a string.`);
    }

    const trimmed = parent.trim();
    const result = validateEntityName(trimmed);
    if (result !== true) {
        throw new Error(`${label} is invalid: ${result}`);
    }

    return trimmed;
}

function normalizeAsConfig(as, label) {
    if (as === undefined || as === null || as === '') {
        return null;
    }

    if (typeof as !== 'string') {
        throw new Error(`${label} must be a string.`);
    }

    const trimmed = as.trim();
    const result = validateFieldName(trimmed);
    if (result !== true) {
        throw new Error(`${label} is invalid: ${result}`);
    }

    return trimmed;
}

function normalizeDtoConfig(dto, label) {
    if (dto === undefined || dto === null) {
        return {
            create: true,
            update: true,
            summary: true,
            detail: true,
        };
    }

    if (typeof dto !== 'object' || Array.isArray(dto)) {
        throw new Error(`${label} must be an object.`);
    }

    for (const key of Object.keys(dto)) {
        if (!DTO_KEYS.includes(key)) {
            throw new Error(`${label}.${key} is not allowed. Allowed keys: ${DTO_KEYS.join(', ')}`);
        }
    }

    return {
        create: dto.create !== undefined ? Boolean(dto.create) : true,
        update: dto.update !== undefined ? Boolean(dto.update) : true,
        summary: dto.summary !== undefined ? Boolean(dto.summary) : true,
        detail: dto.detail !== undefined ? Boolean(dto.detail) : true,
    };
}

function normalizeValidationConfig(rawValidation, field, label) {
    if (rawValidation === undefined || rawValidation === null) {
        return {};
    }

    if (typeof rawValidation !== 'object' || Array.isArray(rawValidation)) {
        throw new Error(`${label} must be an object.`);
    }

    const validation = { ...rawValidation };
    const allowedKeys = getAllowedValidationKeys(field.type);

    for (const key of Object.keys(validation)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`${label}.${key} is not allowed for type ${field.type}. Allowed: ${Array.from(allowedKeys).join(', ')}`);
        }
    }

    if (STRING_TYPES.has(field.type)) {
        normalizeStringValidation(validation, field, label);
    } else if (INTEGER_TYPES.has(field.type)) {
        normalizeIntegerValidation(validation, label);
    } else if (DECIMAL_TYPES.has(field.type)) {
        normalizeDecimalValidation(validation, label);
    } else if (DATE_TYPES.has(field.type)) {
        normalizeDateValidation(validation, label);
    } else if (field.type === 'Boolean') {
        normalizeBooleanValidation(validation, label);
    } else if (field.type === 'Enum' || field.type === 'ManyToOne') {
        if (Object.keys(validation).length > 0) {
            throw new Error(`${label} is not supported for type ${field.type}.`);
        }
    }

    return validation;
}

function getAllowedValidationKeys(type) {
    if (STRING_TYPES.has(type)) {
        return new Set(['email', 'minLength', 'maxLength', 'pattern', 'patternMessage']);
    }

    if (INTEGER_TYPES.has(type)) {
        return new Set(['min', 'max', 'positive', 'positiveOrZero', 'negative', 'negativeOrZero']);
    }

    if (DECIMAL_TYPES.has(type)) {
        return new Set(['decimalMin', 'decimalMax', 'digits', 'positive', 'positiveOrZero', 'negative', 'negativeOrZero']);
    }

    if (DATE_TYPES.has(type)) {
        return new Set(['past', 'pastOrPresent', 'future', 'futureOrPresent']);
    }

    if (type === 'Boolean') {
        return new Set(['assertTrue', 'assertFalse']);
    }

    return new Set();
}

function normalizeStringValidation(validation, field, label) {
    if (validation.email !== undefined && typeof validation.email !== 'boolean') {
        throw new Error(`${label}.email must be boolean.`);
    }

    if (validation.minLength !== undefined) {
        validation.minLength = parsePositiveInteger(validation.minLength, `${label}.minLength`);
    }

    if (validation.maxLength !== undefined) {
        validation.maxLength = parsePositiveInteger(validation.maxLength, `${label}.maxLength`);
    }

    if (validation.minLength !== undefined && validation.maxLength !== undefined && validation.minLength > validation.maxLength) {
        throw new Error(`${label}.minLength cannot be greater than maxLength.`);
    }

    if (validation.pattern !== undefined && typeof validation.pattern !== 'string') {
        throw new Error(`${label}.pattern must be string.`);
    }

    if (validation.patternMessage !== undefined && typeof validation.patternMessage !== 'string') {
        throw new Error(`${label}.patternMessage must be string.`);
    }

    if (validation.patternMessage && !validation.pattern) {
        throw new Error(`${label}.patternMessage requires pattern.`);
    }

    if (validation.maxLength !== undefined && field.length !== undefined && validation.maxLength > field.length) {
        throw new Error(`${label}.maxLength cannot be greater than field.length (${field.length}).`);
    }
}

function normalizeIntegerValidation(validation, label) {
    if (validation.min !== undefined) {
        validation.min = parseInteger(validation.min, `${label}.min`);
    }

    if (validation.max !== undefined) {
        validation.max = parseInteger(validation.max, `${label}.max`);
    }

    if (validation.min !== undefined && validation.max !== undefined && validation.min > validation.max) {
        throw new Error(`${label}.min cannot be greater than max.`);
    }

    normalizeSignValidation(validation, label);
}

function normalizeDecimalValidation(validation, label) {
    if (validation.decimalMin !== undefined) {
        validation.decimalMin = parseDecimalString(validation.decimalMin, `${label}.decimalMin`);
    }

    if (validation.decimalMax !== undefined) {
        validation.decimalMax = parseDecimalString(validation.decimalMax, `${label}.decimalMax`);
    }

    if (validation.decimalMin !== undefined && validation.decimalMax !== undefined) {
        const min = Number(validation.decimalMin);
        const max = Number(validation.decimalMax);

        if (min > max) {
            throw new Error(`${label}.decimalMin cannot be greater than decimalMax.`);
        }
    }

    if (validation.digits !== undefined) {
        if (!validation.digits || typeof validation.digits !== 'object' || Array.isArray(validation.digits)) {
            throw new Error(`${label}.digits must be an object.`);
        }

        validation.digits.integer = parsePositiveInteger(validation.digits.integer, `${label}.digits.integer`);
        validation.digits.fraction = parseNonNegativeInteger(validation.digits.fraction, `${label}.digits.fraction`);
    }

    normalizeSignValidation(validation, label);
}

function normalizeDateValidation(validation, label) {
    const keys = ['past', 'pastOrPresent', 'future', 'futureOrPresent'];
    const active = [];

    for (const key of keys) {
        if (validation[key] !== undefined && typeof validation[key] !== 'boolean') {
            throw new Error(`${label}.${key} must be boolean.`);
        }

        if (validation[key]) {
            active.push(key);
        }
    }

    if (active.length > 1) {
        throw new Error(`${label} date validation must use only one of: ${keys.join(', ')}.`);
    }
}

function normalizeBooleanValidation(validation, label) {
    if (validation.assertTrue !== undefined && typeof validation.assertTrue !== 'boolean') {
        throw new Error(`${label}.assertTrue must be boolean.`);
    }

    if (validation.assertFalse !== undefined && typeof validation.assertFalse !== 'boolean') {
        throw new Error(`${label}.assertFalse must be boolean.`);
    }

    if (validation.assertTrue && validation.assertFalse) {
        throw new Error(`${label}.assertTrue and assertFalse cannot both be true.`);
    }
}

function normalizeSignValidation(validation, label) {
    const keys = ['positive', 'positiveOrZero', 'negative', 'negativeOrZero'];

    for (const key of keys) {
        if (validation[key] !== undefined && typeof validation[key] !== 'boolean') {
            throw new Error(`${label}.${key} must be boolean.`);
        }
    }

    const active = keys.filter((key) => validation[key]);

    if (active.length > 1) {
        throw new Error(`${label} can only use one of: ${keys.join(', ')}.`);
    }
}

function parseInteger(value, label) {
    const n = Number(value);

    if (!Number.isInteger(n)) {
        throw new Error(`${label} must be an integer.`);
    }

    return n;
}

function parsePositiveInteger(value, label) {
    const n = parseInteger(value, label);

    if (n <= 0) {
        throw new Error(`${label} must be greater than 0.`);
    }

    return n;
}

function parseNonNegativeInteger(value, label) {
    const n = parseInteger(value, label);

    if (n < 0) {
        throw new Error(`${label} must be greater than or equal to 0.`);
    }

    return n;
}

function parseDecimalString(value, label) {
    const s = String(value).trim();

    if (!/^-?\d+(\.\d+)?$/.test(s)) {
        throw new Error(`${label} must be a decimal string.`);
    }

    return s;
}

function assertUniqueEntityNames(resources, sourceLabel) {
    const names = new Set();

    for (const resource of resources) {
        if (names.has(resource.entityName)) {
            throw new Error(`${sourceLabel} has duplicate entityName: ${resource.entityName}`);
        }

        names.add(resource.entityName);
    }
}

module.exports = {
    FIELD_TYPES,
    FIELD_TYPE_VALUES,
    DTO_KEYS,
    STRING_TYPES,
    INTEGER_TYPES,
    DECIMAL_TYPES,
    DATE_TYPES,
    loadResourceSpecFile,
    normalizeResourceSpecDocument,
    validateSingleResourceSpec,
    normalizeDtoConfig,
    normalizeValidationConfig,
    assertUniqueEntityNames,
};
