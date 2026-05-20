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
            importPath: `../${ctx.entityPluralKebab}/routes`,
        });
    }

    const routerPath = await registerPluginFeatureRoutes(webDir, routeRegistrations);
    if (routerPath) {
        generatedFiles.push(routerPath);
    }

    const parentPageFiles = await wireNestedChildTablesToParentPages(webDir, resources);
    generatedFiles.push(...parentPageFiles);

    const parentFormFiles = await wireEmbeddedChildTablesToParentForms(webDir, resources);
    generatedFiles.push(...parentFormFiles);

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
    const parentName = resource.parent || '';
    const parentVar = parentName ? _.lowerFirst(parentName) : '';
    const parentParam = parentVar ? `${parentVar}Id` : '';
    const parentPluralKebab = parentName ? _.kebabCase(pluralize(parentVar)) : '';
    const isNestedApi = Boolean(resource.parent && resource.apiStyle === 'nested');
    const featureDir = `src/features/${entityPluralKebab}`;
    const routePath = isNestedApi
        ? `/${parentPluralKebab}/:${parentParam}/${entityPluralKebab}`
        : `/${entityPluralKebab}`;
    const apiPath = isNestedApi
        ? `/api/v1/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}`
        : `/api/v1/${entityPluralKebab}`;
    const fields = fieldsForWebResource(resource);
    const ctx = {
        resource,
        entityName,
        entityVar,
        entityKebab,
        entityPlural,
        entityPluralPascal,
        entityPluralKebab,
        parentName,
        parentVar,
        parentParam,
        parentPluralKebab,
        isNestedApi,
        featureDir,
        routePath,
        apiPath,
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
        PARENT_NAME: parentName,
        PARENT_VAR: parentVar,
        PARENT_PARAM: parentParam,
        PARENT_PLURAL_KEBAB: parentPluralKebab,
        ENTITY_VAR_TITLE: _.startCase(entityVar),
        ENTITY_PLURAL_TITLE: _.startCase(entityPlural),
        ROUTE_PATH: routePath,
        API_PATH: apiPath,
        SERVICE_EXPORT: renderServiceExport({ entityName, entityVar, entityKebab, entityPluralKebab, apiPath, isNestedApi, parentParam }),
        HOOK_EXPORTS: renderHookExports({ entityName, entityVar, entityPluralKebab, entityPluralPascal, isNestedApi, parentParam }),
        HOOK_SERVICE_IMPORT: isNestedApi ? `create${entityName}Service` : `${entityVar}Service`,
        HOOK_API_IMPORT: isNestedApi ? 'import type { SearchRequest } from "@gasi/core-ui";\n' : '',
        LIST_ROUTER_IMPORTS: isNestedApi ? 'useNavigate, useParams' : 'useNavigate',
        CREATE_ROUTER_IMPORTS: isNestedApi ? 'Navigate, useNavigate, useParams' : 'useNavigate',
        LIST_PARENT_SETUP: renderListParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        DETAIL_PARENT_SETUP: renderDetailParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        CREATE_PARENT_SETUP: renderCreateParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        EDIT_PARENT_SETUP: renderEditParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        CREATE_MISSING_PARENT_GUARD: isNestedApi ? `    if (!${parentParam}) {
        return <Navigate to="/${parentPluralKebab}" replace />;
    }
` : '',
        PAGE_QUERY_PROP: isNestedApi ? 'pageQuery={pageQuery}' : `pageQuery={use${entityPluralPascal}Page}`,
        DETAIL_QUERY_ARGS: isNestedApi ? `${parentParam}, params.id` : 'params.id',
        CREATE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        UPDATE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        DELETE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        NAVIGATE_LIST: isNestedApi ? 'listPath' : `"${routePath}"`,
        NAVIGATE_CREATE: isNestedApi ? '`${listPath}/create`' : `"${routePath}/create"`,
        COLUMNS_BASE_PATH_ARG: isNestedApi ? 'basePath: listPath,' : '',
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

function fieldsForWebResource(resource) {
    if (!resource.parent || resource.apiStyle !== 'root') {
        return resource.fields;
    }

    const parentFieldName = _.lowerFirst(resource.parent);
    if (resource.fields.some((field) => field.name === parentFieldName)) {
        return resource.fields;
    }

    return [
        {
            name: parentFieldName,
            type: 'ManyToOne',
            refEntity: resource.parent,
            required: true,
            unique: false,
            filterable: true,
            defaultColumn: true,
            dto: {
                create: true,
                update: true,
                summary: true,
                detail: true,
            },
            validation: {},
        },
        ...resource.fields,
    ];
}

function renderServiceExport({ entityName, entityVar, apiPath, isNestedApi, parentParam }) {
    const generics = `<\n    ${entityName}Summary,\n    ${entityName}Detail,\n    ${entityName}CreateRequest,\n    ${entityName}UpdateRequest\n>`;

    if (!isNestedApi) {
        return `export const ${entityVar}Service = createBaseService${generics}("${apiPath}");`;
    }

    return `export function create${entityName}Service(${parentParam}: string) {
    return createBaseService${generics}(\`${apiPath}\`);
}`;
}

function renderHookExports({ entityName, entityVar, entityPluralKebab, entityPluralPascal, isNestedApi, parentParam }) {
    const generics = `<\n    ${entityName}Summary,\n    ${entityName}Detail,\n    ${entityName}CreateRequest,\n    ${entityName}UpdateRequest\n>`;

    if (!isNestedApi) {
        return `const hooks = createBaseHooks${generics}("${entityPluralKebab}", ${entityVar}Service);

export const ${entityVar}QueryKeys = hooks.queryKeys;
export const use${entityPluralPascal} = hooks.useList;
export const use${entityPluralPascal}Page = hooks.usePage;
export const use${entityName} = hooks.useDetail;
export const useCreate${entityName} = hooks.useCreate;
export const useUpdate${entityName} = hooks.useUpdate;
export const useDelete${entityName} = hooks.useDelete;`;
    }

    return `function create${entityName}Hooks(${parentParam}: string) {
    return createBaseHooks${generics}("${entityPluralKebab}", create${entityName}Service(${parentParam}));
}

export function ${entityVar}QueryKeys(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).queryKeys;
}

export function use${entityPluralPascal}(${parentParam}: string, request?: SearchRequest) {
    return create${entityName}Hooks(${parentParam}).useList(request);
}

export function use${entityPluralPascal}Page(${parentParam}: string, request?: SearchRequest) {
    return create${entityName}Hooks(${parentParam}).usePage(request);
}

export function use${entityName}(${parentParam}: string | undefined, id?: string) {
    return create${entityName}Hooks(${parentParam} ?? "").useDetail(${parentParam} ? id : undefined);
}

export function useCreate${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useCreate();
}

export function useUpdate${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useUpdate();
}

export function useDelete${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useDelete();
}`;
}

function renderListParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const params = useParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
    const pageQuery = useCallback((request: Parameters<typeof use${_.upperFirst(pluralize(_.camelCase(entityPluralKebab)))}Page>[1]) =>
        use${_.upperFirst(pluralize(_.camelCase(entityPluralKebab)))}Page(${parentParam} ?? "", request), [${parentParam}]);
`;
}

function renderDetailParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
`;
}

function renderCreateParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const params = useParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
`;
}

function renderEditParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
`;
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
        .map((item) => `import { ${item} } from "@gasi/core-ui";`)
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
        const props = renderFieldProps(field);

        if (field.type === 'Boolean') {
            return `                        <FormSwitch form={form} name="${fieldName}" label="${label}"${props} />`;
        }

        if (field.type === 'Date') {
            return `                        <FormDatePicker form={form} name="${fieldName}" label="${label}"${props} />`;
        }

        if (field.type === 'DateTime' || field.type === 'Instant') {
            return `                        <FormDateTimePicker form={form} name="${fieldName}" label="${label}"${props} />`;
        }

        if (field.type === 'ManyToOne') {
            return `                        <FormLookupPicker form={form} name="${fieldName}" label="${label}" options={[]}${props} />`;
        }

        if (field.type === 'Enum') {
            return `                        <FormSelect form={form} name="${fieldName}" label="${label}" options={[]}${props} />`;
        }

        return `                        <FormInput form={form} name="${fieldName}" label="${label}"${inputTypeAttr(field)}${props} />`;
    }).join('\n\n');
}

function renderFieldProps(field) {
    const props = renderFieldHintProps(field);
    return `${field.required ? ' required' : ''}${props}`;
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

async function registerPluginFeatureRoutes(webDir, routeRegistrations) {
    if (!routeRegistrations.length) {
        return null;
    }

    const pluginFeatureName = await resolvePluginFeatureName(webDir);
    const routerPath = path.join(webDir, 'src', 'features', pluginFeatureName, 'routes.tsx');
    if (!(await fs.pathExists(routerPath))) {
        return null;
    }

    const original = await fs.readFile(routerPath, 'utf8');
    let content = original;

    const missingSpreads = routeRegistrations
        .filter((registration) => !content.includes(`...${registration.exportName}`))
        .map((registration) => `  ...${registration.exportName},`);

    for (const registration of routeRegistrations) {
        const importLine = `import { ${registration.exportName} } from '${registration.importPath}';`;

        if (!content.includes(importLine)) {
            content = insertAfterImportBlock(content, importLine);
        }
    }

    if (missingSpreads.length) {
        content = insertIntoRouteDefinitionArray(content, missingSpreads.join('\n'));
    }

    if (content === original) {
        return null;
    }

    await fs.writeFile(routerPath, content, 'utf8');
    return routerPath;
}

async function resolvePluginFeatureName(webDir) {
    const packageJsonPath = path.join(webDir, 'package.json');
    const fromDir = normalizePluginFeatureName(path.basename(webDir));

    if (!(await fs.pathExists(packageJsonPath))) {
        return fromDir;
    }

    try {
        const pkg = await fs.readJson(packageJsonPath);
        const packageName = String(pkg.name || '').split('/').pop();
        return normalizePluginFeatureName(packageName || fromDir);
    } catch {
        return fromDir;
    }
}

function normalizePluginFeatureName(value) {
    return _.kebabCase(String(value || '')
        .replace(/^@[^/]+\//, '')
        .replace(/^plugin-/, '')
        .replace(/-plugin$/, ''));
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

function insertIntoRouteDefinitionArray(content, spreadLines) {
    const markerPattern = /(\n\s*\/\/ routes akan ditambahkan oleh `gasi resource create`)/;
    if (markerPattern.test(content)) {
        return content.replace(markerPattern, `\n${spreadLines}$1`);
    }

    const arrayEndPattern = /(\n\];\s*)$/;
    if (arrayEndPattern.test(content)) {
        return content.replace(arrayEndPattern, `\n${spreadLines}$1`);
    }

    return content;
}

async function wireNestedChildTablesToParentPages(webDir, resources) {
    const changed = [];
    const nestedChildren = resources.filter((resource) => resource.parent && resource.apiStyle === 'nested');

    for (const child of nestedChildren) {
        const childCtx = buildWebResourceContext(child);
        const parentVar = _.lowerFirst(child.parent);
        const parentKebab = _.kebabCase(child.parent);
        const parentPluralKebab = _.kebabCase(pluralize(parentVar));
        const parentPagesDir = path.join(webDir, 'src', 'features', parentPluralKebab, 'pages');
        const detailFile = path.join(parentPagesDir, `${parentKebab}-detail-page.tsx`);
        const editFile = path.join(parentPagesDir, `${parentKebab}-edit-page.tsx`);

        for (const file of [detailFile, editFile]) {
            if (!(await fs.pathExists(file))) {
                continue;
            }

            const original = await fs.readFile(file, 'utf8');
            const next = patchParentPageWithNestedChildTable(original, childCtx);
            if (next !== original) {
                await fs.writeFile(file, next, 'utf8');
                changed.push(file);
            }
        }
    }

    return [...new Set(changed)];
}

function patchParentPageWithNestedChildTable(content, childCtx) {
    const marker = `GASI_NESTED_CHILD_TAB: ${childCtx.entityPlural}`;
    if (content.includes(marker)) {
        return content;
    }

    let next = content;
    next = ensureNamedImport(next, 'react', ['useCallback', 'useMemo']);
    next = ensureNamedImport(next, 'react-router', ['useNavigate']);
    next = ensureNamedImport(next, '@gasi/core-ui', ['Button', 'Card', 'CardContent', 'ServerDataTable', 'Tabs', 'TabsContent', 'TabsList', 'TabsTrigger']);
    next = ensureNamedImport(next, 'lucide-react', ['Plus']);
    next = insertAfterImportBlock(next, `import { get${childCtx.entityName}Columns } from "../../${childCtx.entityPluralKebab}/components/${childCtx.entityKebab}-columns";`);
    next = insertAfterImportBlock(next, `import { use${childCtx.entityPluralPascal}Page } from "../../${childCtx.entityPluralKebab}/hooks/use-${childCtx.entityKebab}";`);

    if (!next.includes('const navigate = useNavigate();')) {
        next = next.replace(/(export function [^{]+{\n)/, `$1    const navigate = useNavigate();\n`);
    }

    const setup = renderNestedChildTableSetup(childCtx);
    if (!next.includes(`${childCtx.entityVar}ListPath`)) {
        next = next.replace(/(const params = useParams\(\);\n)/, `$1${setup}`);
    }

    return insertNestedChildTableSection(next, childCtx, marker);
}

function ensureNamedImport(content, source, names) {
    const importRegex = new RegExp(`^import \\{ ([^}]+) \\} from "${escapeRegExp(source)}";$`, 'gm');
    const matches = [...content.matchAll(importRegex)];

    if (!matches.length) {
        const importLine = `import { ${names.sort().join(', ')} } from "${source}";`;
        return insertAfterImportBlock(content, importLine);
    }

    const existing = matches.flatMap((match) =>
        match[1].split(',').map((name) => name.trim()).filter(Boolean));
    const merged = [...new Set([...existing, ...names])].sort();
    let replaced = false;

    return content.replace(importRegex, () => {
        if (replaced) {
            return '';
        }

        replaced = true;
        return `import { ${merged.join(', ')} } from "${source}";`;
    }).replace(/\n{3,}/g, '\n\n');
}

function renderNestedChildTableSetup(childCtx) {
    return `    const ${childCtx.entityVar}ListPath = params.id ? \`/${childCtx.parentPluralKebab}/\${params.id}/${childCtx.entityPluralKebab}\` : "/${childCtx.entityPluralKebab}";
    const ${childCtx.entityVar}PageQuery = useCallback((request: Parameters<typeof use${childCtx.entityPluralPascal}Page>[1]) =>
        use${childCtx.entityPluralPascal}Page(params.id ?? "", request), [params.id]);
    const ${childCtx.entityVar}Columns = useMemo(() => get${childCtx.entityName}Columns({
        basePath: ${childCtx.entityVar}ListPath,
        showDelete: false,
    }), [${childCtx.entityVar}ListPath]);
`;
}

function renderNestedChildTabTrigger(childCtx, marker) {
    return `                    {/* ${marker} */}
                    <TabsTrigger value="${childCtx.entityPluralKebab}">{{TITLE}}</TabsTrigger>`
        .replaceAll('{{TITLE}}', _.startCase(childCtx.entityPlural));
}

function renderNestedChildTabContent(childCtx) {
    return `                <TabsContent value="${childCtx.entityPluralKebab}">
                    <Card>
                <CardContent>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">{{TITLE}}</h2>
                            <p className="text-sm text-muted-foreground">Manage {{TITLE}} for this record.</p>
                        </div>
                        <Button type="button" onClick={() => navigate(\`\${${childCtx.entityVar}ListPath}/create\`)}>
                            <Plus className="size-4" />
                            Add {{SINGLE_TITLE}}
                        </Button>
                    </div>
                    <ServerDataTable
                        columns={${childCtx.entityVar}Columns}
                        pageQuery={${childCtx.entityVar}PageQuery}
                        searchFields={${renderSearchFields(childCtx)}}
                        searchPlaceholder="Search ${childCtx.entityPlural}..."
                        loadingTitle="Loading {{TITLE}}..."
                        emptyTitle="No {{TITLE}} found"
                        emptyDescription="Create a new {{SINGLE_TITLE}} to get started."
                        enableColumnSettings
                        columnPreferenceKey="${childCtx.entityKebab}-embedded-table"
                        defaultVisibleColumns={${renderDefaultVisibleColumns(childCtx)}}
                    />
                </CardContent>
            </Card>
                </TabsContent>`
        .replaceAll('{{TITLE}}', _.startCase(childCtx.entityPlural))
        .replaceAll('{{SINGLE_TITLE}}', _.startCase(childCtx.entityVar));
}

function renderNestedChildTabsSection(childCtx, marker, generalContent) {
    return `
            {/* GASI_NESTED_CHILD_TABS */}
            <Tabs defaultValue="general">
                <TabsList variant="line">
                    <TabsTrigger value="general">General</TabsTrigger>
${renderNestedChildTabTrigger(childCtx, marker)}
                </TabsList>
                <TabsContent value="general">
${generalContent.trimEnd()}
                </TabsContent>
${renderNestedChildTabContent(childCtx)}
            </Tabs>`;
}

function insertNestedChildTableSection(content, childCtx, marker) {
    if (content.includes('GASI_NESTED_CHILD_TABS')) {
        let next = content;
        next = next.replace(
            /(\n\s*<\/TabsList>)/,
            `\n${renderNestedChildTabTrigger(childCtx, marker)}$1`,
        );
        next = next.replace(
            /(\n\s*<\/Tabs>\s*)/,
            `\n${renderNestedChildTabContent(childCtx)}$1`,
        );
        return next;
    }

    const closing = '\n        </div>\n    );';
    const idx = content.lastIndexOf(closing);
    if (idx === -1) {
        return content;
    }

    const pageHeaderStart = content.lastIndexOf('<PageHeader', idx);
    if (pageHeaderStart === -1) {
        return content;
    }

    const headerLineStart = content.lastIndexOf('\n', pageHeaderStart);
    const headerLineEnd = content.indexOf('\n', pageHeaderStart);
    if (headerLineStart === -1 || headerLineEnd === -1 || headerLineEnd > idx) {
        return content;
    }

    const headerEnd = headerLineEnd + 1;
    const generalContent = content.slice(headerEnd, idx);
    return `${content.slice(0, headerEnd)}${renderNestedChildTabsSection(childCtx, marker, generalContent)}${content.slice(idx)}`;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function wireEmbeddedChildTablesToParentForms(webDir, resources) {
    const changed = [];
    const embeddedChildren = resources.filter((resource) => resource.parent && resource.embedInParentDto);

    for (const child of embeddedChildren) {
        const childCtx = buildWebResourceContext(child);
        const parentVar = _.lowerFirst(child.parent);
        const parentKebab = _.kebabCase(child.parent);
        const parentPluralKebab = _.kebabCase(pluralize(parentVar));
        const childFieldName = child.as || pluralize(_.lowerFirst(child.entityName));
        const baseDir = path.join(webDir, 'src', 'features', parentPluralKebab);

        const files = [
            path.join(baseDir, 'types', `${parentKebab}.types.ts`),
            path.join(baseDir, 'schemas', `${parentKebab}-create-schema.ts`),
            path.join(baseDir, 'schemas', `${parentKebab}-update-schema.ts`),
            path.join(baseDir, 'components', `${parentKebab}-form.tsx`),
        ];

        for (const file of files) {
            if (!(await fs.pathExists(file))) {
                continue;
            }

            const original = await fs.readFile(file, 'utf8');
            const next = patchEmbeddedChildFile(original, file, childCtx, childFieldName);
            if (next !== original) {
                await fs.writeFile(file, next, 'utf8');
                changed.push(file);
            }
        }
    }

    return [...new Set(changed)];
}

function patchEmbeddedChildFile(content, file, childCtx, childFieldName) {
    if (file.endsWith('.types.ts')) {
        return patchParentTypesWithEmbeddedChild(content, childCtx, childFieldName);
    }

    if (file.endsWith('-create-schema.ts') || file.endsWith('-update-schema.ts')) {
        return patchParentSchemaWithEmbeddedChild(content, childCtx, childFieldName);
    }

    if (file.endsWith('-form.tsx')) {
        return patchParentFormWithEmbeddedChild(content, childCtx, childFieldName);
    }

    return content;
}

function patchParentTypesWithEmbeddedChild(content, childCtx, childFieldName) {
    if (content.includes(`${childFieldName}: Array<{`)) {
        return content;
    }

    const fieldType = renderEmbeddedChildTsField(childCtx, childFieldName);
    let next = content;
    next = next.replace(/(export type \w+Detail = \{\n\s*id: string;\n)/, `$1${fieldType}`);
    next = next.replace(/(export type \w+CreateRequest = \{\n)/, `$1${fieldType}`);
    next = next.replace(/(export type \w+UpdateRequest = \{\n)/, `$1${fieldType}`);
    return next;
}

function renderEmbeddedChildTsField(childCtx, childFieldName) {
    const fields = childCtx.resource.fields.map((field) =>
        `        ${requestFieldName(field)}${field.required ? '' : '?'}: ${tsRequestType(field)};`).join('\n');
    return `    ${childFieldName}: Array<{\n${fields}\n    }>;\n`;
}

function patchParentSchemaWithEmbeddedChild(content, childCtx, childFieldName) {
    if (content.includes(`${childFieldName}: z.array(z.object({`)) {
        return content;
    }

    const schema = renderEmbeddedChildSchemaField(childCtx, childFieldName);
    return content.replace(/(export const \w+(Create|Update)Schema = z\.object\(\{\n)/, `$1${schema}`);
}

function renderEmbeddedChildSchemaField(childCtx, childFieldName) {
    const fields = childCtx.resource.fields.map((field) =>
        `        ${requestFieldName(field)}: ${renderZodField(field)},`).join('\n');
    return `    ${childFieldName}: z.array(z.object({\n${fields}\n    })).default([]),\n`;
}

function patchParentFormWithEmbeddedChild(content, childCtx, childFieldName) {
    const marker = `GASI_EMBEDDED_CHILD_TABLE: ${childFieldName}`;
    if (content.includes(marker)) {
        return content;
    }

    let next = ensureNamedImport(content, '@gasi/core-ui', ['FormArrayTable']);
    next = next.replace(
        /defaultValues: props\.defaultValues as Partial<(\w+)>,/,
        `defaultValues: { ${childFieldName}: [], ...props.defaultValues } as Partial<$1>,`,
    );

    const table = renderEmbeddedChildFormArrayTable(childCtx, childFieldName, marker);
    return next.replace(
        /(\n\s*<div className="flex justify-end gap-2 border-t pt-5">)/,
        `\n${table}$1`,
    );
}

function renderEmbeddedChildFormArrayTable(childCtx, childFieldName, marker) {
    return `                    {/* ${marker} */}
                    <FormArrayTable
                        form={form}
                        name="${childFieldName}"
                        title="${_.startCase(childCtx.entityPlural)}"
                        addLabel="Add ${_.startCase(childCtx.entityVar)}"
                        emptyText="No ${_.startCase(childCtx.entityPlural)} added."
                        createRow={() => (${renderEmbeddedChildCreateRow(childCtx)})}
                        columns={[
${renderEmbeddedChildColumns(childCtx)}
                        ]}
                    />
`;
}

function renderEmbeddedChildCreateRow(childCtx) {
    const entries = childCtx.resource.fields.map((field) => `${requestFieldName(field)}: ${defaultValueForField(field)}`);
    return `{ ${entries.join(', ')} }`;
}

function defaultValueForField(field) {
    if (field.type === 'Boolean') return 'false';
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) return '0';
    return '""';
}

function renderEmbeddedChildColumns(childCtx) {
    return childCtx.resource.fields.map((field) => {
        const type = embeddedColumnType(field);
        const options = field.type === 'Enum' || field.type === 'ManyToOne' || type === 'select' || type === 'lookup'
            ? ', options: []'
            : '';
        return `                            { name: "${requestFieldName(field)}", header: "${labelForField(field)}", type: "${type}"${options} },`;
    }).join('\n');
}

function embeddedColumnType(field) {
    if (field.type === 'ManyToOne') return 'lookup';
    if (field.type === 'Enum') return 'select';
    if (field.type === 'Date') return 'date';
    if (field.type === 'DateTime' || field.type === 'Instant') return 'datetime-local';
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) return 'number';
    if (field.validation?.email) return 'email';
    return 'text';
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
