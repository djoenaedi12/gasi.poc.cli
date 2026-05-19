const _ = require('lodash');
const pluralize = require('pluralize');
const path = require('path');
const fs = require('fs-extra');

const { renderTemplateTree } = require('./api-template-engine');

const FORM_IMPORT_PATHS = {
    FormButton: 'form-button',
    FormCheckbox: 'form-checkbox',
    FormDatePicker: 'form-date-picker',
    FormDateTimePicker: 'form-datetime-picker',
    FormInput: 'form-input',
    FormLookupPicker: 'form-lookup-picker',
    FormSelect: 'form-select',
    FormSwitch: 'form-switch',
};

async function generateWebResources({ webDir, resources, force = false }) {
    await assertWebProjectRoot(webDir);

    const generatedFiles = [];
    const routeRegistrations = [];
    const templateRoot = path.join(__dirname, '..', 'templates', 'web', 'resource');

    for (const resource of resources) {
        const ctx = buildWebResourceContext(resource);

        if (!force) {
            await checkTemplateConflicts(templateRoot, webDir, ctx);
        }

        await renderTemplateTree(templateRoot, webDir, ctx);
        generatedFiles.push(...await collectGeneratedPaths(templateRoot, webDir, ctx));
        routeRegistrations.push({
            exportName: `${ctx.entityVar}Routes`,
            importPath: `@/features/${ctx.entityPluralKebab}/routes`,
        });
    }

    const routerPath = await registerWebRoutes(webDir, routeRegistrations);
    if (routerPath) {
        generatedFiles.push(routerPath);
    }

    return generatedFiles;
}

async function assertWebProjectRoot(webDir) {
    if (!webDir) {
        throw new Error('--web-dir is required for --target web/all unless current directory is the web project.');
    }

    const packageJson = path.join(webDir, 'package.json');
    const srcDir = path.join(webDir, 'src');

    if (!(await fs.pathExists(packageJson)) || !(await fs.pathExists(srcDir))) {
        throw new Error(`Invalid web project root: ${webDir}. Expected package.json and src/.`);
    }
}

function buildWebResourceContext(resource) {
    const entityName = resource.entityName;
    const entityVar = _.lowerFirst(entityName);
    const entityKebab = _.kebabCase(entityName);
    const entityPlural = pluralize(entityVar);
    const entityPluralPascal = _.upperFirst(entityPlural);
    const entityPluralKebab = _.kebabCase(entityPlural);
    const featureDir = `src/features/${entityPluralKebab}`;
    const routePath = `/${_.kebabCase(entityPlural)}`;
    const fields = resource.fields;
    const ctx = {
        resource,
        entityName,
        entityVar,
        entityKebab,
        entityPlural,
        entityPluralPascal,
        entityPluralKebab,
        featureDir,
        routePath,
        fields,
        createFields: fields.filter((field) => isDtoIncluded(field, 'create')),
        updateFields: fields.filter((field) => isDtoIncluded(field, 'update')),
        summaryFields: fields.filter((field) => isDtoIncluded(field, 'summary')),
        defaultColumnFields: fields.filter((field) => isDtoIncluded(field, 'summary') && field.defaultColumn !== false),
        detailFields: fields.filter((field) => isDtoIncluded(field, 'detail')),
        filterFields: fields.filter((field) => field.filterable),
    };

    return {
        ...ctx,
        ENTITY_NAME: entityName,
        ENTITY_VAR: entityVar,
        ENTITY_KEBAB: entityKebab,
        ENTITY_PLURAL: entityPlural,
        ENTITY_PLURAL_PASCAL: entityPluralPascal,
        ENTITY_PLURAL_KEBAB: entityPluralKebab,
        ENTITY_VAR_TITLE: _.startCase(entityVar),
        ENTITY_PLURAL_TITLE: _.startCase(entityPlural),
        ROUTE_PATH: routePath,
        CREATE_TYPE: `${entityName}CreateFormData`,
        UPDATE_TYPE: `${entityName}UpdateFormData`,
        TYPES_SUMMARY_FIELDS: ctx.summaryFields.map((field) => renderTsField(field)).join('\n'),
        TYPES_DETAIL_FIELDS: ctx.detailFields.map((field) => renderTsField(field)).join('\n'),
        TYPES_CREATE_FIELDS: ctx.createFields.map((field) => renderTsRequestField(field)).join('\n'),
        TYPES_UPDATE_FIELDS: ctx.updateFields.map((field) => renderTsRequestField(field)).join('\n'),
        CREATE_SCHEMA_FIELDS: renderSchemaFields(ctx, 'create'),
        UPDATE_SCHEMA_FIELDS: renderSchemaFields(ctx, 'update'),
        FORM_IMPORTS: renderFormImports(ctx),
        FORM_FIELDS: renderFormFields(ctx),
        COLUMN_FIELDS: renderColumnFields(ctx),
        DEFAULT_VISIBLE_COLUMNS: renderDefaultVisibleColumns(ctx),
        SEARCH_FIELDS: renderSearchFields(ctx),
        DETAIL_FIELDS: renderDetailFields({
            ...ctx,
            detailFields: ctx.detailFields.length ? ctx.detailFields : ctx.fields,
        }),
    };
}

async function checkTemplateConflicts(templateRoot, targetRoot, ctx) {
    const entries = await walk(templateRoot);

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        const targetPath = path.join(targetRoot, replacePathTokens(relPath, ctx));

        if (await fs.pathExists(targetPath)) {
            throw new Error(`File already exists: ${targetPath}. Use --web-force to overwrite.`);
        }
    }
}

async function collectGeneratedPaths(templateRoot, targetRoot, ctx) {
    const entries = await walk(templateRoot);
    const paths = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        paths.push(path.join(targetRoot, replacePathTokens(relPath, ctx)));
    }

    return paths;
}

async function walk(dir) {
    const out = [];
    async function recurse(current) {
        const items = await fs.readdir(current, { withFileTypes: true });
        for (const item of items) {
            const full = path.join(current, item.name);
            if (item.isDirectory()) {
                out.push({ fullPath: full, isDirectory: true, isFile: false });
                await recurse(full);
            } else if (item.isFile()) {
                out.push({ fullPath: full, isDirectory: false, isFile: true });
            }
        }
    }
    await recurse(dir);
    return out;
}

function replacePathTokens(value, ctx) {
    return value.replace(/\[\[([A-Z0-9_]+)\]\]/g, (match, key) => (key in ctx ? ctx[key] : match));
}

function renderSchemaFields(ctx, kind) {
    const fields = kind === 'create' ? ctx.createFields : ctx.updateFields;
    return fields.map((field) => `    ${requestFieldName(field)}: ${renderZodField(field)},`).join('\n');
}

function renderFormImports(ctx) {
    return collectFormImports(ctx)
        .map((item) => `import { ${item} } from "@/components/molecules/${FORM_IMPORT_PATHS[item]}";`)
        .join('\n');
}

function renderColumnFields(ctx) {
    return ctx.summaryFields.map((field) => `        {
            accessorKey: "${responseFieldName(field)}",
            header: "${labelForField(field)}",
            enableSorting: true,
        },`).join('\n');
}

function renderDefaultVisibleColumns(ctx) {
    const fields = ctx.defaultColumnFields.map((field) => `"${responseFieldName(field)}"`);
    return `[${fields.join(', ')}]`;
}

function renderSearchFields(ctx) {
    const fields = [...ctx.filterFields]
        .sort((left, right) => {
            if (left.name === 'name') return -1;
            if (right.name === 'name') return 1;
            return 0;
        })
        .map((field) => `"${responseFieldName(field)}"`);

    return `[${fields.join(', ')}]`;
}

function renderFieldHintProps(field) {
    const parts = [];
    if (field.tooltip) parts.push(`tooltip="${field.tooltip.replace(/"/g, '\\"')}"`);
    if (field.description) parts.push(`description="${field.description.replace(/"/g, '\\"')}"`);
    return parts.length ? ' ' + parts.join(' ') : '';
}

function renderDetailFields(ctx) {
    return ctx.detailFields.map((field) => `                        <div>
                            <dt className="text-sm font-medium text-muted-foreground">${labelForField(field)}</dt>
                            <dd className="mt-1 text-sm">{String(${ctx.entityVar}.${responseFieldName(field)} ?? "-")}</dd>
                        </div>`).join('\n\n');
}

function renderFormFields(ctx) {
    const allFields = uniqueByName([...ctx.createFields, ...ctx.updateFields]);

    return allFields.map((field) => {
        const fieldName = requestFieldName(field);
        const label = labelForField(field);
        const hints = renderFieldHintProps(field);

        if (field.type === 'Boolean') {
            return `                        <FormSwitch form={form} name="${fieldName}" label="${label}"${hints} />`;
        }

        if (field.type === 'Date') {
            return `                        <FormDatePicker form={form} name="${fieldName}" label="${label}"${hints} />`;
        }

        if (field.type === 'DateTime' || field.type === 'Instant') {
            return `                        <FormDateTimePicker form={form} name="${fieldName}" label="${label}"${hints} />`;
        }

        if (field.type === 'ManyToOne') {
            return `                        <FormLookupPicker form={form} name="${fieldName}" label="${label}" options={[]}${hints} />`;
        }

        if (field.type === 'Enum') {
            return `                        <FormSelect form={form} name="${fieldName}" label="${label}" options={[]}${hints} />`;
        }

        return `                        <FormInput form={form} name="${fieldName}" label="${label}"${inputTypeAttr(field)}${hints} />`;
    }).join('\n\n');
}

function collectFormImports(ctx) {
    const imports = new Set(['FormButton', 'FormInput']);
    const fields = uniqueByName([...ctx.createFields, ...ctx.updateFields]);

    for (const field of fields) {
        if (field.type === 'Boolean') imports.add('FormSwitch');
        if (field.type === 'Date') imports.add('FormDatePicker');
        if (field.type === 'DateTime' || field.type === 'Instant') imports.add('FormDateTimePicker');
        if (field.type === 'ManyToOne') imports.add('FormLookupPicker');
        if (field.type === 'Enum') imports.add('FormSelect');
    }

    return [...imports].sort();
}

function renderTsField(field) {
    return `    ${responseFieldName(field)}: ${tsType(field)};`;
}

function renderTsRequestField(field) {
    return `    ${requestFieldName(field)}${field.required ? '' : '?'}: ${tsRequestType(field)};`;
}

function renderZodField(field) {
    if (field.type === 'Boolean') {
        return field.required ? 'z.boolean()' : 'z.boolean().optional()';
    }

    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) {
        return field.required ? 'z.coerce.number()' : 'z.coerce.number().optional()';
    }

    let chain = 'z.string()';

    if (field.validation?.email) {
        chain = chain.replace('z.string()', 'z.string().email("Invalid email format")');
    }

    if (field.required) {
        chain += '.min(1, "This field is required")';
    }

    if (field.validation?.minLength !== undefined) {
        chain += `.min(${field.validation.minLength})`;
    }

    if (field.validation?.maxLength !== undefined) {
        chain += `.max(${field.validation.maxLength})`;
    } else if (field.length) {
        chain += `.max(${field.length})`;
    }

    if (!field.required) {
        chain += '.optional()';
    }

    return chain;
}

async function registerWebRoutes(webDir, routeRegistrations) {
    if (!routeRegistrations.length) {
        return null;
    }

    const routerPath = path.join(webDir, 'src', 'routes', 'index.tsx');
    if (!(await fs.pathExists(routerPath))) {
        return null;
    }

    const original = await fs.readFile(routerPath, 'utf8');
    let content = original;

    const missingSpreads = routeRegistrations
        .filter((registration) => !content.includes(`...${registration.exportName}`))
        .map((registration) => `            ...${registration.exportName},`);

    if (missingSpreads.length && !canInsertIntoRouterChildren(content)) {
        return null;
    }

    for (const registration of routeRegistrations) {
        const importLine = `import { ${registration.exportName} } from '${registration.importPath}';`;

        if (!content.includes(importLine)) {
            content = insertAfterImportBlock(content, importLine);
        }
    }

    if (missingSpreads.length) {
        content = insertIntoRouterChildren(content, missingSpreads.join('\n'));
    }

    if (content === original) {
        return null;
    }

    await fs.writeFile(routerPath, content, 'utf8');
    return routerPath;
}

function insertAfterImportBlock(content, importLine) {
    const importMatches = [...content.matchAll(/^import .+;$/gm)];

    if (!importMatches.length) {
        return `${importLine}\n${content}`;
    }

    const lastImport = importMatches[importMatches.length - 1];
    const insertAt = lastImport.index + lastImport[0].length;
    return `${content.slice(0, insertAt)}\n${importLine}${content.slice(insertAt)}`;
}

function canInsertIntoRouterChildren(content) {
    return /\n\s*\{\s*index:\s*true,\s*element:\s*<[^>]+>\s*\},/.test(content)
        || /children:\s*\[\n/.test(content);
}

function insertIntoRouterChildren(content, spreadLines) {
    const indexRoutePattern = /(\n\s*\{\s*index:\s*true,\s*element:\s*<[^>]+>\s*\},)/;

    if (indexRoutePattern.test(content)) {
        return content.replace(indexRoutePattern, `$1\n${spreadLines}`);
    }

    const childrenPattern = /(children:\s*\[\n)/;
    if (childrenPattern.test(content)) {
        return content.replace(childrenPattern, `$1${spreadLines}\n`);
    }

    return content;
}

function inputTypeAttr(field) {
    if (field.validation?.email) return ' type="email"';
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) return ' type="number"';
    return '';
}

function requestFieldName(field) {
    return field.type === 'ManyToOne' ? `${field.name}Id` : field.name;
}

function responseFieldName(field) {
    return field.type === 'ManyToOne' ? `${field.name}Id` : field.name;
}

function tsType(field) {
    if (field.type === 'Boolean') return 'boolean';
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) return 'number';
    return 'string';
}

function tsRequestType(field) {
    return tsType(field);
}

function labelForField(field) {
    return _.startCase(field.name);
}

function isDtoIncluded(field, dtoName) {
    return !field.dto || field.dto[dtoName] !== false;
}

function uniqueByName(fields) {
    return [...new Map(fields.map((field) => [requestFieldName(field), field])).values()];
}

module.exports = { generateWebResources };
