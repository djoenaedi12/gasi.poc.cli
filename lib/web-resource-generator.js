const _ = require('lodash');
const pluralize = require('pluralize');
const path = require('path');
const fs = require('fs-extra');

const { renderTemplateTree } = require('./api-template-engine');

const FORM_IMPORT_PATHS = {
    FormButton: 'FormButton',
    FormCheckbox: 'FormCheckbox',
    FormDatePicker: 'FormDatePicker',
    FormDateTimePicker: 'FormDateTimePicker',
    FormInput: 'FormInput',
    FormLookupPicker: 'FormLookupPicker',
    FormSelect: 'FormSelect',
    FormSwitch: 'FormSwitch',
};

async function generateWebResources({ webDir, resources, force = false }) {
    await assertWebProjectRoot(webDir);

    const generatedFiles = [];
    const routeRegistrations = [];
    const templateRoot = path.join(__dirname, '..', 'templates', 'web', 'resource');

    for (const resource of resources) {
        if (resource.parent && resource.embedInParentDto) {
            continue;
        }

        const ctx = buildWebResourceContext(resource);
        const shouldInclude = (relPath) => shouldIncludeWebTemplate(relPath, ctx);

        if (!force) {
            await checkTemplateConflicts(templateRoot, webDir, ctx, shouldInclude);
        }

        await renderTemplateTree(templateRoot, webDir, ctx, { shouldInclude });
        generatedFiles.push(...await collectGeneratedPaths(templateRoot, webDir, ctx, shouldInclude));
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
    const mode = resource.mode || 'crud';
    const isReadMode = mode === 'read';
    const featureDir = `src/features/${entityPluralKebab}`;
    const routePath = isNestedApi
        ? `/${parentPluralKebab}/:${parentParam}/${entityPluralKebab}`
        : `/${entityPluralKebab}`;
    const apiPath = isNestedApi
        ? `/api/v1/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}`
        : `/api/v1/${entityPluralKebab}`;
    const fields = fieldsForWebResource(resource);
    const defaultColumnFields = buildDefaultColumnFields(resource, fields);
    const tableFilterFields = buildTableFilterFields(resource, fields);
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
        defaultColumnFields,
        detailFields: fields.filter((field) => isDtoIncluded(field, 'detail')),
        filterFields: fields.filter((field) => field.filterable),
        tableFilterFields,
        mode,
        isReadMode,
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
        RESOURCE_MODE: mode,
        ROUTE_IMPORTS: renderRouteImports(ctx),
        ROUTE_CORE_UI_IMPORTS: 'createResourceRoutes, translate',
        ROUTE_DEFINITIONS: renderRouteDefinitions(ctx),
        SERVICE_EXPORT: renderServiceExport({ entityName, entityVar, entityKebab, entityPluralKebab, apiPath, isNestedApi, parentParam }),
        HOOK_EXPORTS: renderHookExports({ entityName, entityVar, entityPluralKebab, entityPluralPascal, isNestedApi, parentParam, isReadMode }),
        HOOK_SERVICE_IMPORT: isNestedApi ? `create${entityName}Service` : `${entityVar}Service`,
        HOOK_API_IMPORT: isNestedApi ? 'import type { SearchRequest } from "@gasi/core-ui";\n' : '',
        LIST_ROUTER_IMPORT: renderListRouterImport(ctx),
        LIST_NAVIGATE_SETUP: isReadMode ? '' : '    const navigate = useNavigate();',
        LIST_ICON_IMPORTS: renderListIconImports(ctx),
        LIST_CORE_API_IMPORTS: renderListCoreApiImports(ctx),
        LIST_STORE_IMPORT: renderListStoreImport(ctx),
        LIST_DELETE_IMPORT: renderListDeleteImport(ctx),
        LIST_BULK_DELETE_IMPORT: renderListBulkDeleteImport(ctx),
        LIST_BUTTON_IMPORT: renderListButtonImport(ctx),
        LIST_TOAST_IMPORT: isReadMode ? '' : 'import { appToast } from "@gasi/core-ui";',
        LIST_REACT_IMPORT: renderListReactImport(ctx),
        LIST_TYPE_IMPORTS: renderListTypeImports(ctx),
        LIST_FILTER_IMPORTS: renderListFilterImports(ctx),
        LIST_LOOKUP_IMPORTS: renderListLookupHookImports(ctx),
        CREATE_ROUTER_IMPORTS: isNestedApi ? 'Navigate, useNavigate, useParams, useSearchParams' : 'useNavigate',
        EDIT_ROUTER_IMPORTS: isNestedApi ? 'Navigate, useNavigate, useParams, useSearchParams' : 'Navigate, useNavigate, useParams',
        LIST_PARENT_SETUP: renderListParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        DETAIL_ICON_IMPORTS: isReadMode ? '' : 'import { Edit } from "lucide-react";',
        DETAIL_ROUTER_IMPORTS: renderDetailRouterImports(ctx),
        DETAIL_CORE_API_IMPORTS: '',
        DETAIL_STORE_IMPORT: isReadMode ? '' : 'import { useResourcePermissions } from "@gasi/core-starter";',
        DETAIL_BUTTON_IMPORT: isReadMode ? '' : 'import { Button } from "@gasi/core-ui";',
        DETAIL_NAVIGATE_SETUP: isReadMode ? '' : '    const navigate = useNavigate();',
        DETAIL_PERMISSION_SETUP: isReadMode ? '' : `    const { canUpdate } = useResourcePermissions("${entityVar}");`,
        DETAIL_PARENT_SETUP: renderDetailParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        CREATE_PARENT_SETUP: renderCreateParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        EDIT_PARENT_SETUP: renderEditParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }),
        CREATE_MISSING_PARENT_GUARD: isNestedApi ? `    if (!${parentParam}) {
        return <Navigate to="/${parentPluralKebab}" replace />;
    }
` : '',
        PAGE_QUERY_PROP: isNestedApi ? 'pageQuery: pageQuery,' : `pageQuery: use${entityPluralPascal}Page,`,
        DETAIL_QUERY_ARGS: isNestedApi ? `${parentParam}, params.id` : 'params.id',
        CREATE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        UPDATE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        DELETE_HOOK_ARGS: isNestedApi ? `${parentParam} ?? ""` : '',
        NAVIGATE_LIST: isNestedApi ? 'listPath' : `"${routePath}"`,
        NAVIGATE_AFTER_SAVE: isNestedApi ? 'parentDetailPath' : `"${routePath}"`,
        NAVIGATE_CREATE: isNestedApi ? '`${listPath}/create`' : `"${routePath}/create"`,
        NAVIGATE_EDIT: isNestedApi ? '`${listPath}/${params.id}/edit`' : `\`${routePath}/\${params.id}/edit\``,
        COLUMNS_BASE_PATH_ARG: isNestedApi ? 'basePath: listPath,' : '',
        LIST_PERMISSIONS: renderListPermissions(ctx),
        LIST_DELETE_HANDLERS: renderListDeleteHandlers(ctx),
        LIST_BULK_UPLOAD_HANDLER: renderListBulkUploadHandler(ctx),
        LIST_COLUMNS_CONFIG: renderListColumnsConfig(ctx),
        LIST_COLUMNS_DEPS: renderListColumnsDeps(ctx),
        LIST_HEADER_ACTIONS: renderListHeaderActions(ctx),
        LIST_BREADCRUMBS: renderListBreadcrumbs(ctx),
        CREATE_BREADCRUMBS: renderCreateBreadcrumbs(ctx),
        EDIT_BREADCRUMBS: renderEditBreadcrumbs(ctx),
        DETAIL_BREADCRUMBS: renderDetailBreadcrumbs(ctx),
        LIST_ROW_SELECTION_PROPS: renderListRowSelectionProps(ctx),
        DETAIL_ACTIONS: renderDetailActions(ctx),
        COLUMN_ACTION_IMPORT: renderColumnActionImport(ctx),
        COLUMN_OPTIONS: renderColumnOptions(ctx),
        COLUMN_PARAMS: renderColumnParams(ctx),
        COLUMN_ACTION_ITEM: renderColumnActionItem(ctx),
        CREATE_TYPE: `${entityName}CreateFormData`,
        UPDATE_TYPE: `${entityName}UpdateFormData`,
        TYPES_SUMMARY_FIELDS: ctx.summaryFields.map((field) => renderTsField(field)).join('\n'),
        TYPES_DETAIL_FIELDS: ctx.detailFields.map((field) => renderTsField(field)).join('\n'),
        TYPES_CREATE_FIELDS: ctx.createFields.map((field) => renderTsRequestField(field)).join('\n'),
        TYPES_UPDATE_FIELDS: ctx.updateFields.map((field) => renderTsRequestField(field)).join('\n'),
        CREATE_SCHEMA_FIELDS: renderSchemaFields(ctx, 'create'),
        UPDATE_SCHEMA_FIELDS: renderSchemaFields(ctx, 'update'),
        FORM_IMPORTS: renderFormImports(ctx),
        FORM_LOOKUP_IMPORTS: renderLookupHookImports(ctx),
        LOOKUP_LABEL_FIELDS: renderStringArray(lookupPresetLabelFields(ctx)),
        LOOKUP_DESCRIPTION_FIELDS: renderStringArray(lookupPresetDescriptionFields(ctx)),
        LOOKUP_META_FIELDS: renderStringArray(lookupPresetColumns(ctx).map((column) => column.field)),
        LOOKUP_DISPLAY_COLUMNS: renderLookupPresetDisplayColumns(ctx),
        LOOKUP_SEARCH_FIELDS: renderStringArray(lookupPresetSearchFields(ctx)),
        FORM_FIELDS: renderFormFields(ctx),
        COLUMN_FIELDS: renderColumnFields(ctx),
        DEFAULT_VISIBLE_COLUMNS: renderDefaultVisibleColumns(ctx),
        TYPES_ENUMS: renderEnumTypeAliases(ctx),
        SEARCH_FIELDS: renderSearchFields(ctx),
        DATATABLE_FILTERS: renderDataTableFilters(ctx),
        ADVANCED_FILTER_STATE: renderAdvancedFilterState(ctx),
        ADVANCED_FILTER_LOGIC: renderAdvancedFilterLogic(ctx),
        DETAIL_FIELDS: renderDetailFields({
            ...ctx,
            detailFields: ctx.detailFields.length ? ctx.detailFields : ctx.fields,
        }),
        BREADCRUMB_LABEL: renderBreadcrumbLabel(ctx),
        I18N_KEY_PREFIX: entityPluralKebab,
        I18N_LOCALE_EN: renderResourceLocale(ctx),
        I18N_LOCALE_ID: renderResourceLocale(ctx),
    };
}

function isVisibleByDefault(field) {
    if (field.ui?.table?.visibleByDefault !== undefined) {
        return field.ui.table.visibleByDefault;
    }

    return field.defaultColumn !== false;
}

function buildDefaultColumnFields(resource, fields) {
    const configuredColumns = resource.ui?.table?.defaultColumns;
    const summaryFields = fields.filter((field) => isDtoIncluded(field, 'summary'));

    if (configuredColumns?.length) {
        return configuredColumns.map((columnName) => {
            const field = summaryFields.find((candidate) =>
                requestFieldName(candidate) === columnName ||
                responseFieldName(candidate) === columnName ||
                candidate.name === columnName,
            );

            if (!field) {
                throw new Error(`${resource.entityName}.ui.table.defaultColumns references unknown summary field "${columnName}".`);
            }

            return field;
        });
    }

    return summaryFields.filter((field) => isVisibleByDefault(field));
}

function isUiTableFilterEnabled(field) {
    return field.ui?.table?.filter?.enabled === true;
}

function buildTableFilterFields(resource, fields) {
    const configuredFilters = resource.ui?.table?.filters;

    if (configuredFilters?.length) {
        return configuredFilters.map((filterConfig) => {
            const field = fields.find((candidate) =>
                requestFieldName(candidate) === filterConfig.field ||
                responseFieldName(candidate) === filterConfig.field ||
                candidate.name === filterConfig.field,
            );

            if (!field) {
                throw new Error(`${resource.entityName}.ui.table.filters references unknown field "${filterConfig.field}".`);
            }

            return {
                ...field,
                ui: {
                    ...(field.ui ?? {}),
                    table: {
                        ...(field.ui?.table ?? {}),
                        filter: {
                            ...(field.ui?.table?.filter ?? {}),
                            ...filterConfig,
                            enabled: true,
                        },
                    },
                },
            };
        });
    }

    const fieldConfiguredFilters = fields.filter((field) => isUiTableFilterEnabled(field));
    if (fieldConfiguredFilters.length) {
        return fieldConfiguredFilters;
    }

    return fields.filter((field) =>
        field.filterable &&
        !['String', 'Text', 'MediumText'].includes(field.type),
    );
}

function hasExplicitSearchableFields(ctx) {
    return Boolean(ctx.resource.ui?.table?.searchFields?.length) ||
        ctx.fields.some((field) => field.ui?.table?.searchable !== undefined);
}

function hasExplicitTableFilterConfig(ctx) {
    if (ctx.resource.ui?.table?.filters?.length) {
        return true;
    }

    return ctx.fields.some((field) => field.ui?.table?.filter?.enabled !== undefined);
}

function advancedFilterFields(ctx) {
    return [];
}

function hasAdvancedFilters(ctx) {
    return advancedFilterFields(ctx).length > 0;
}

function isReadMode(ctx) {
    return ctx.mode === 'read' || ctx.isReadMode;
}

function renderRouteImports(ctx) {
    const lines = [
        `import { ${ctx.entityName}ListPage }   from "./pages/${ctx.entityName}ListPage";`,
        `import { ${ctx.entityName}DetailPage } from "./pages/${ctx.entityName}DetailPage";`,
    ];

    if (!isReadMode(ctx)) {
        lines.splice(1, 0, `import { ${ctx.entityName}CreatePage } from "./pages/${ctx.entityName}CreatePage";`);
        lines.push(`import { ${ctx.entityName}EditPage }   from "./pages/${ctx.entityName}EditPage";`);
    }

    return lines.join('\n');
}

function renderRouteDefinitions(ctx) {
    const entries = [
        `        resource: "${ctx.entityVar}",`,
        `        basePath: "${ctx.routePath}",`,
        `        entityLabel: translate("${ctx.entityPluralKebab}.names.singular"),`,
        `        list: ${ctx.entityName}ListPage,`,
        `        detail: ${ctx.entityName}DetailPage,`,
    ];

    if (!isReadMode(ctx)) {
        entries.splice(4, 0, `        create: ${ctx.entityName}CreatePage,`);
        entries.push(`        edit: ${ctx.entityName}EditPage,`);
    }

    return `    ...createResourceRoutes({
${entries.join('\n')}
    }),`;
}

function renderDetailRouterImports(ctx) {
    if (isReadMode(ctx)) {
        return ctx.isNestedApi ? 'Navigate, useParams, useSearchParams' : 'Navigate, useParams';
    }

    return ctx.isNestedApi ? 'Navigate, useNavigate, useParams, useSearchParams' : 'Navigate, useNavigate, useParams';
}

function renderListRouterImport(ctx) {
    if (isReadMode(ctx) && !ctx.isNestedApi) {
        return '';
    }

    const imports = ctx.isNestedApi
        ? isReadMode(ctx) ? 'useParams' : 'useNavigate, useParams'
        : 'useNavigate';

    return `import { ${imports} } from "react-router";`;
}

function renderListIconImports(ctx) {
    return isReadMode(ctx) ? '' : 'import { Plus, Upload } from "lucide-react";';
}

function renderListCoreApiImports(ctx) {
    return '';
}

function renderListStoreImport(ctx) {
    return 'import { useResourcePermissions } from "@gasi/core-starter";';
}

function renderListDeleteImport(ctx) {
    return isReadMode(ctx) ? `use${ctx.entityPluralPascal}Page` : `useDelete${ctx.entityName}, use${ctx.entityPluralPascal}Page`;
}

function renderListBulkDeleteImport(ctx) {
    return isReadMode(ctx) ? '' : 'import { DataTableBulkDeleteAction } from "@gasi/core-ui";';
}

function renderListButtonImport(ctx) {
    return isReadMode(ctx) ? '' : 'import { Button } from "@gasi/core-ui";';
}

function renderListReactImport(ctx) {
    const imports = new Set(['useMemo']);

    if (!isReadMode(ctx) || hasAdvancedFilters(ctx)) {
        imports.add('useCallback');
    }

    if (hasAdvancedFilters(ctx)) {
        imports.add('useState');
    }

    return `import { ${[...imports].sort().join(', ')} } from "react";`;
}

function renderListPermissions(ctx) {
    if (isReadMode(ctx)) {
        return `    const { canDownload } = useResourcePermissions("${ctx.entityVar}");`;
    }

    return `    const delete${ctx.entityName} = useDelete${ctx.entityName}(${ctx.isNestedApi ? `${ctx.parentParam} ?? ""` : ''});
    const { canCreate, canUpdate, canDelete, canDownload, canUpload } = useResourcePermissions("${ctx.entityVar}");`;
}

function renderListDeleteHandlers(ctx) {
    if (isReadMode(ctx)) return '';

    return `
    const handleDelete = useCallback(async (id: string) => {
        try {
            await delete${ctx.entityName}.mutateAsync(id);
            appToast.success(t("common.messages.deleteSuccess", { entity: t("${ctx.entityPluralKebab}.names.singular") }));
        } catch (error) {
            appToast.error(error, t("common.messages.deleteError", { entity: t("${ctx.entityPluralKebab}.names.singular") }));
        }
    }, [delete${ctx.entityName}, t]);

    const handleBulkDelete = useCallback(async (ids: string[]) => {
        try {
            await Promise.all(ids.map((id) => delete${ctx.entityName}.mutateAsync(id)));
            appToast.success(t("common.messages.deleteSuccess", { entity: pluralEntity }));
        } catch (error) {
            appToast.error(error, t("common.messages.deleteError", { entity: pluralEntity }));
        }
    }, [delete${ctx.entityName}, pluralEntity, t]);
`;
}

function renderListBulkUploadHandler(ctx) {
    if (isReadMode(ctx)) return '';

    return `
    const handleBulkUpload = useCallback(() => {
        const params = new URLSearchParams({
            backTo: ${ctx.isNestedApi ? 'listPath' : `"${ctx.routePath}"`},
            label: pluralEntity,
            resource: "${ctx.entityVar}",
        });

        navigate(\`${ctx.isNestedApi ? '${listPath}' : ctx.routePath}/upload?\${params.toString()}\`);
    }, [${ctx.isNestedApi ? 'listPath, ' : ''}navigate, pluralEntity]);
`;
}

function renderListColumnsConfig(ctx) {
    const tLine = 't,';

    if (isReadMode(ctx)) {
        return ctx.isNestedApi ? `basePath: listPath,\n            ${tLine}` : tLine;
    }

    return `${ctx.isNestedApi ? 'basePath: listPath,\n            ' : ''}onDelete: canDelete ? handleDelete : undefined,
            showEdit: canUpdate,
            showDelete: canDelete,
            ${tLine}`;
}

function renderListColumnsDeps(ctx) {
    if (isReadMode(ctx)) {
        return ctx.isNestedApi ? '[listPath, t]' : '[t]';
    }

    return ctx.isNestedApi ? '[canDelete, canUpdate, handleDelete, listPath, t]' : '[canDelete, canUpdate, handleDelete, t]';
}

function renderListHeaderActions(ctx) {
    if (isReadMode(ctx)) return '';

    return `actions={
                    canCreate || canUpload ? (
                        <>
                            {canUpload ? (
                                <Button type="button" variant="outline" onClick={handleBulkUpload}>
                                    <Upload className="size-4" />
                                    {t("common.actions.importEntity", { entity: pluralEntity })}
                                </Button>
                            ) : null}

                            {canCreate ? (
                                <Button type="button" onClick={() => navigate(${ctx.isNestedApi ? '`${listPath}/create`' : `"${ctx.routePath}/create"`})}>
                                    <Plus className="size-4" />
                                    {t("common.actions.addEntity", { entity: t("${ctx.entityPluralKebab}.names.singular") })}
                                </Button>
                            ) : null}
                        </>
                    ) : null
                }`;
}

function renderListRowSelectionProps(ctx) {
    if (isReadMode(ctx)) return '';

    return `enableRowSelection: true,
                getRowId: (row) => row.id,
                renderSelectedActions: (selectedRows) => (
                            <>
                                {canDelete ? (
                                    <DataTableBulkDeleteAction
                                        selectedRows={selectedRows}
                                        entityName={pluralEntity}
                                        getRowId={(row) => row.id}
                                        onDelete={handleBulkDelete}
                                    />
                                ) : null}
                            </>
                        ),`;
}

function renderDetailActions(ctx) {
    if (isReadMode(ctx)) return '';

    return `actions={
                    canUpdate ? (
                        <Button
                            type="button"
                            onClick={() => navigate(${ctx.isNestedApi ? '`${listPath}/${params.id}/edit?backTo=${encodeURIComponent(parentDetailPath)}`' : `\`${ctx.routePath}/\${params.id}/edit\``})}
                        >
                            <Edit className="size-4" />
                            {t("common.actions.edit")}
                        </Button>
                    ) : null
                }`;
}

function renderColumnActionImport(ctx) {
    return 'import { getDataTableRowActionsColumn } from "@gasi/core-ui";';
}

function renderColumnOptions(ctx) {
    if (isReadMode(ctx)) {
        return `    basePath?: string;
    t: Translate;`;
    }

    return `    basePath?: string;
    onDelete?: (id: string) => void;
    backTo?: string;
    showEdit?: boolean;
    showDelete?: boolean;
    t: Translate;`;
}

function renderColumnParams(ctx) {
    if (isReadMode(ctx)) {
        return `    basePath = "${ctx.routePath}",
    t,`;
    }

    return `    basePath = "${ctx.routePath}",
    onDelete,
    backTo,
    showEdit = true,
    showDelete = true,
    t,`;
}

function renderColumnActionItem(ctx) {
    if (isReadMode(ctx)) {
        return `
        getDataTableRowActionsColumn({
            basePath,
            entityName: t("${ctx.entityPluralKebab}.names.singular"),
            getRowId: (${ctx.entityVar}) => ${ctx.entityVar}.id,
            showEdit: false,
            showDelete: false,
            presentation: "inline",
        })`;
    }

    return `
        getDataTableRowActionsColumn({
            basePath,
            entityName: t("${ctx.entityPluralKebab}.names.singular"),
            getRowId: (${ctx.entityVar}) => ${ctx.entityVar}.id,
            onDelete: onDelete ? (id) => onDelete(id) : undefined,
            backTo,
            showEdit,
            showDelete,
            presentation: "inline",
        })`;
}

function renderListTypeImports(ctx) {
    return '';
}

function renderListFilterImports(ctx) {
    return '';
}

function renderListLookupHookImports(ctx) {
    const lookupFilters = ctx.tableFilterFields.filter((field) =>
        (field.ui?.table?.filter?.type ?? inferDataTableFilterType(field)) === 'lookup' &&
        field.type === 'ManyToOne'
    );
    const imports = lookupRefEntities(lookupFilters)
        .map((ref) => `import { ${ref.varName}Lookup } from "../../${ref.pluralKebab}/lookups";`);

    return imports.join('\n');
}

function lookupRefEntities(fields) {
    const refs = fields
        .filter((field) => field.type === 'ManyToOne' && field.refEntity)
        .map((field) => {
            const name = field.refEntity;
            const singularVar = _.lowerFirst(name);
            const pluralVar = pluralize(singularVar);

            return {
                name,
                varName: singularVar,
                pluralKebab: _.kebabCase(pluralVar),
                pluralPascal: _.upperFirst(pluralVar),
            };
        });

    return [...new Map(refs.map((ref) => [ref.name, ref])).values()];
}

function lookupLabelFields(field) {
    return field?.ui?.lookup?.labelFields?.length
        ? field.ui.lookup.labelFields
        : ['name', 'code', 'fullName', 'employeeNo'];
}

function lookupDescriptionFields(field) {
    return field?.ui?.lookup?.descriptionFields?.length
        ? field.ui.lookup.descriptionFields
        : [];
}

function lookupSearchFields(field) {
    return field?.ui?.lookup?.searchFields?.length
        ? field.ui.lookup.searchFields
        : lookupLabelFields(field);
}

function lookupColumns(field) {
    if (field?.ui?.lookup?.columns?.length) {
        return field.ui.lookup.columns;
    }

    return lookupLabelFields(field).map((item) => ({
        field: item,
        label: _.startCase(item),
    }));
}

function renderStringArray(values) {
    return `[${values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`).join(', ')}]`;
}

function renderLookupDisplayColumns(field) {
    return `[${lookupColumns(field)
        .map((column) => `{ key: "${String(column.field).replace(/"/g, '\\"')}", header: "${String(column.label).replace(/"/g, '\\"')}" }`)
        .join(', ')}]`;
}

function lookupPresetLabelFields(ctx) {
    if (ctx.resource.ui?.lookup?.labelFields?.length) {
        return ctx.resource.ui.lookup.labelFields;
    }

    const available = new Set(ctx.summaryFields.map(responseFieldName));
    const preferred = ['name', 'code', 'fullName', 'employeeNo'].filter((field) => available.has(field));
    if (preferred.length) {
        return preferred;
    }

    const fallback = ctx.summaryFields
        .map(responseFieldName)
        .filter((field) => field !== 'id')
        .slice(0, 2);

    return fallback.length ? fallback : ['id'];
}

function lookupPresetDescriptionFields(ctx) {
    return ctx.resource.ui?.lookup?.descriptionFields ?? [];
}

function lookupPresetSearchFields(ctx) {
    if (ctx.resource.ui?.lookup?.searchFields?.length) {
        return ctx.resource.ui.lookup.searchFields;
    }

    return lookupPresetLabelFields(ctx).filter((field) => field !== 'id');
}

function lookupPresetColumns(ctx) {
    if (ctx.resource.ui?.lookup?.columns?.length) {
        return ctx.resource.ui.lookup.columns;
    }

    return lookupPresetLabelFields(ctx)
        .filter((field) => field !== 'id')
        .map((field) => ({ field, label: _.startCase(field) }));
}

function renderLookupPresetDisplayColumns(ctx) {
    return `[${lookupPresetColumns(ctx)
        .map((column) => `{ key: "${String(column.field).replace(/"/g, '\\"')}", header: "${String(column.label).replace(/"/g, '\\"')}" }`)
        .join(', ')}]`;
}

function renderLookupMapOption(field) {
    const labelFields = lookupLabelFields(field);
    const descriptionFields = lookupDescriptionFields(field);
    const columns = lookupColumns(field);

    return `{(item) => {
                                const record = item as Record<string, unknown>;
                                const label = ${renderStringArray(labelFields)}.map((field) => record[field])
                                    .filter(Boolean)
                                    .join(" - ") || String(record.id);
                                const description = ${renderStringArray(descriptionFields)}.map((field) => record[field])
                                    .filter(Boolean)
                                    .join(" - ");

                                return {
                                    value: String(record.id),
                                    label,
                                    description: description || undefined,
                                    meta: Object.fromEntries(${renderStringArray(columns.map((column) => column.field))}.map((field) => [field, record[field]])),
                                };
                            }}`;
}

function lookupPresetVar(field) {
    return `${_.lowerFirst(field.refEntity)}Lookup`;
}

function renderLookupConfigExpression(field) {
    const base = lookupPresetVar(field);
    if (!field.ui?.lookup) {
        return base;
    }

    return `{
                        ...${base},
                        mapOption: ${renderLookupMapOption(field)},
                        displayColumns: ${renderLookupDisplayColumns(field)},
                        searchFields: ${renderStringArray(lookupSearchFields(field))},
                    }`;
}

function advancedFilterStateName(field) {
    return `${requestFieldName(field)}Filter`;
}

function renderAdvancedFilterState(ctx) {
    const fields = advancedFilterFields(ctx);
    if (!fields.length) {
        return '';
    }

    return '\n' + fields
        .map((field) => `    const [${advancedFilterStateName(field)}, set${_.upperFirst(advancedFilterStateName(field))}] = useState("");`)
        .join('\n');
}

function advancedFilterOperator(field) {
    if (['Integer', 'Long', 'BigDecimal', 'Double', 'Boolean', 'Date', 'DateTime', 'Instant', 'Enum', 'ManyToOne'].includes(field.type)) {
        return 'EQUALS';
    }

    return 'LIKE';
}

function advancedFilterValue(field) {
    const stateName = advancedFilterStateName(field);
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) {
        return `Number(${stateName})`;
    }

    if (field.type === 'Boolean') {
        return `${stateName} === "true"`;
    }

    return stateName;
}

function renderAdvancedFilterLogic(ctx) {
    return '';
}

function renderBreadcrumbLabel(ctx) {
    const identifierFields = ctx.resource.identifier?.length
        ? ctx.resource.identifier
        : ['name', 'code'].filter((fieldName) =>
            ctx.detailFields.some((field) => responseFieldName(field) === fieldName),
        );

    if (!identifierFields.length) {
        return `params.id ?? singularEntity`;
    }

    const values = identifierFields
        .map((fieldName) => {
            const field = ctx.detailFields.find((candidate) => candidate.name === fieldName);
            return `${ctx.entityVar}.${field ? responseFieldName(field) : fieldName}`;
        })
        .join(', ');

    return `[${values}].filter(Boolean).join(" - ") || params.id || singularEntity`;
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

function renderHookExports({ entityName, entityVar, entityPluralKebab, entityPluralPascal, isNestedApi, parentParam, isReadMode = false }) {
    const generics = `<\n    ${entityName}Summary,\n    ${entityName}Detail,\n    ${entityName}CreateRequest,\n    ${entityName}UpdateRequest\n>`;

    if (!isNestedApi) {
        const writeExports = isReadMode ? '' : `
export const useCreate${entityName} = hooks.useCreate;
export const useUpdate${entityName} = hooks.useUpdate;
export const useDelete${entityName} = hooks.useDelete;`;

        return `const hooks = createBaseHooks${generics}("${entityPluralKebab}", ${entityVar}Service);

export const ${entityVar}QueryKeys = hooks.queryKeys;
export const use${entityPluralPascal} = hooks.useList;
export const use${entityPluralPascal}Page = hooks.usePage;
export const use${entityPluralPascal}LookupPage = hooks.useLookupPage;
export const use${entityName} = hooks.useDetail;${writeExports}`;
    }

    const nestedWriteExports = isReadMode ? '' : `

export function useCreate${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useCreate();
}

export function useUpdate${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useUpdate();
}

export function useDelete${entityName}(${parentParam}: string) {
    return create${entityName}Hooks(${parentParam}).useDelete();
}`;

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

export function use${entityPluralPascal}LookupPage(${parentParam}: string, request?: SearchRequest) {
    return create${entityName}Hooks(${parentParam}).useLookupPage(request);
}

export function use${entityName}(${parentParam}: string | undefined, id?: string) {
    return create${entityName}Hooks(${parentParam} ?? "").useDetail(${parentParam} ? id : undefined);
}${nestedWriteExports}`;
}

function renderListParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const params = useParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
    const parentDetailPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}";
    const pageQuery = useCallback((request: Parameters<typeof use${_.upperFirst(pluralize(_.camelCase(entityPluralKebab)))}Page>[1]) =>
        use${_.upperFirst(pluralize(_.camelCase(entityPluralKebab)))}Page(${parentParam} ?? "", request), [${parentParam}]);
`;
}

function renderDetailParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const [searchParams] = useSearchParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
    const parentDetailPath = searchParams.get("backTo") || (${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}");
    const parentViewPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}";
    const isParentEdit = parentDetailPath.includes("/edit");
`;
}

function renderCreateParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const params = useParams();
    const [searchParams] = useSearchParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const parentDetailPath = searchParams.get("backTo") || (${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}");
    const parentViewPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}";
    const isParentEdit = parentDetailPath.includes("/edit");
`;
}

function renderEditParentSetup({ isNestedApi, parentParam, entityPluralKebab, parentPluralKebab }) {
    if (!isNestedApi) return '';

    return `    const [searchParams] = useSearchParams();
    const ${parentParam} = params.${parentParam} as string | undefined;
    const listPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}/${entityPluralKebab}\` : "/${entityPluralKebab}";
    const parentDetailPath = searchParams.get("backTo") || (${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}");
    const parentViewPath = ${parentParam} ? \`/${parentPluralKebab}/\${${parentParam}}?tab=${entityPluralKebab}\` : "/${parentPluralKebab}";
    const isParentEdit = parentDetailPath.includes("/edit");
`;
}

function renderListBreadcrumbs(ctx) {
    if (!ctx.isNestedApi) return '';

    return `breadcrumbs={${ctx.parentParam} ? [
                { label: t("${ctx.parentPluralKebab}.names.plural"), href: "/${ctx.parentPluralKebab}" },
                { label: ${ctx.parentParam}, href: parentDetailPath },
                { label: pluralEntity },
            ] : undefined}`;
}

function renderCreateBreadcrumbs(ctx) {
    if (!ctx.isNestedApi) return '';

    return `breadcrumbs={[
                    { label: t("${ctx.parentPluralKebab}.names.plural"), href: "/${ctx.parentPluralKebab}" },
                    { label: ${ctx.parentParam}, href: parentViewPath },
                    ...(isParentEdit ? [{ label: t("common.actions.edit"), href: parentDetailPath }] : []),
                    { label: t("${ctx.entityPluralKebab}.names.plural") },
                    { label: t("common.actions.create") },
                ]}`;
}

function renderEditBreadcrumbs(ctx) {
    if (!ctx.isNestedApi) return '';

    return `breadcrumbs={[
                    { label: t("${ctx.parentPluralKebab}.names.plural"), href: "/${ctx.parentPluralKebab}" },
                    { label: ${ctx.parentParam} ?? t("${ctx.parentPluralKebab}.names.singular"), href: parentViewPath },
                    ...(isParentEdit ? [{ label: t("common.actions.edit"), href: parentDetailPath }] : []),
                    { label: t("${ctx.entityPluralKebab}.names.plural") },
                    { label: t("common.actions.edit") },
                ]}`;
}

function renderDetailBreadcrumbs(ctx) {
    if (!ctx.isNestedApi) return '';

    return `breadcrumbs={[
                    { label: t("${ctx.parentPluralKebab}.names.plural"), href: "/${ctx.parentPluralKebab}" },
                    { label: ${ctx.parentParam} ?? t("${ctx.parentPluralKebab}.names.singular"), href: parentViewPath },
                    ...(isParentEdit ? [{ label: t("common.actions.edit"), href: parentDetailPath }] : []),
                    { label: t("${ctx.entityPluralKebab}.names.plural") },
                    { label: t("common.actions.view") },
                ]}`;
}

async function checkTemplateConflicts(templateRoot, targetRoot, ctx, shouldInclude) {
    const entries = await walk(templateRoot);

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        if (shouldInclude && !shouldInclude(relPath)) continue;

        const targetPath = path.join(targetRoot, replacePathTokens(relPath, ctx));

        if (await fs.pathExists(targetPath)) {
            throw new Error(`File already exists: ${targetPath}. Use --web-force to overwrite.`);
        }
    }
}

async function collectGeneratedPaths(templateRoot, targetRoot, ctx, shouldInclude) {
    const entries = await walk(templateRoot);
    const paths = [];

    for (const entry of entries) {
        if (entry.isDirectory) continue;

        const relPath = path.relative(templateRoot, entry.fullPath);
        if (shouldInclude && !shouldInclude(relPath)) continue;

        paths.push(path.join(targetRoot, replacePathTokens(relPath, ctx)));
    }

    return paths;
}

function shouldIncludeWebTemplate(relPath, ctx) {
    const normalized = relPath.split(path.sep).join('/');
    if (ctx.isNestedApi && normalized.includes('/lookups/')) {
        return false;
    }

    if (!isReadMode(ctx)) {
        return true;
    }

    const readModeExcluded = [
        '/components/[[ENTITY_NAME]]Form.tsx',
        '/pages/[[ENTITY_NAME]]CreatePage.tsx',
        '/pages/[[ENTITY_NAME]]EditPage.tsx',
        '/schemas/[[ENTITY_VAR]]CreateSchema.ts',
        '/schemas/[[ENTITY_VAR]]UpdateSchema.ts',
    ];

    return !readModeExcluded.some((suffix) => normalized.endsWith(suffix));
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
    return fields.map((field) => `        ${requestFieldName(field)}: ${renderZodField(field, ctx)},`).join('\n');
}

function renderFormImports(ctx) {
    return collectFormImports(ctx)
        .map((item) => `import { ${item} } from "@gasi/core-ui";`)
        .join('\n');
}

function renderLookupHookImports(ctx) {
    const imports = lookupRefEntities(uniqueByName([...ctx.createFields, ...ctx.updateFields]))
        .map((ref) => `import { ${ref.varName}Lookup } from "../../${ref.pluralKebab}/lookups";`);

    return imports.join('\n');
}

function renderColumnFields(ctx) {
    return ctx.summaryFields.map((field) => `        {
            accessorKey: "${responseFieldName(field)}",
            header: t("${ctx.entityPluralKebab}.fields.${requestFieldName(field)}"),
            enableSorting: true,
        },`).join('\n');
}

function renderDefaultVisibleColumns(ctx) {
    const fields = ctx.defaultColumnFields.map((field) => `"${responseFieldName(field)}"`);
    return `[${fields.join(', ')}]`;
}

function renderSearchFields(ctx) {
    if (ctx.resource.ui?.table?.searchFields?.length) {
        return renderStringArray(ctx.resource.ui.table.searchFields);
    }

    const fields = (hasExplicitSearchableFields(ctx)
        ? ctx.fields.filter((field) => field.ui?.table?.searchable === true)
        : ctx.filterFields.filter((field) => ['String', 'Text', 'MediumText'].includes(field.type))
    )
        .sort((left, right) => {
            if (left.name === 'name') return -1;
            if (right.name === 'name') return 1;
            return 0;
        })
        .map((field) => `"${responseFieldName(field)}"`);

    return `[${fields.join(', ')}]`;
}

function renderDataTableFilters(ctx) {
    if (!ctx.tableFilterFields.length) {
        return '';
    }

    return `filters: [
${ctx.tableFilterFields.map((field) => renderDataTableFilter(field, ctx)).join(',\n')}
                ],`;
}

function renderDataTableFilter(field, ctx) {
    const fieldName = requestFieldName(field);
    const responseName = responseFieldName(field);
    const label = `t("${ctx.entityPluralKebab}.fields.${fieldName}")`;
    const filter = field.ui?.table?.filter ?? {};
    const type = filter.type ?? inferDataTableFilterType(field);
    const placement = filter.placement ?? 'toolbar';
    const parts = [
        `                    {
                        id: "${responseName}",
                        label: ${label},
                        chipLabel: ${label},`,
    ];

    if (type === 'date-range') {
        parts.push(`                        type: "date-range" as const,
                        value: "",
                        placement: "${placement}" as const,
                        range: {
                            from: { field: "${fieldName}", operator: "GREATER_THAN_OR_EQUALS" as const },
                            to: { field: "${fieldName}", operator: "LESS_THAN_OR_EQUALS" as const },
                        },`);
    } else {
        parts.push(`                        field: "${fieldName}",
                        operator: "${dataTableFilterOperator(field)}" as const,
                        type: "${type}" as const,
                        value: "",
                        placement: "${placement}" as const,`);

        const renderControl = renderDataTableFilterControl(field, type);
        if (renderControl) {
            parts.push(renderControl);
        }

        if (type === 'lookup' && field.type === 'ManyToOne') {
            const entityLabel = lookupEntityLabelExpression(field, `"${labelForField(field)}"`);
            parts.push(`                        lookup: ${renderLookupConfigExpression(field)},
                        placeholder: t("common.actions.selectEntity", { entity: ${entityLabel} }),
                        searchPlaceholder: t("common.search.byFields", { fields: ${entityLabel}.toLowerCase() }),
                        emptyMessage: t("common.empty.title", { entity: ${entityLabel} }),`);
        }

        const options = renderDataTableFilterOptions(field, ctx);
        if (options) {
            parts.push(options);
        }

        const transformValue = renderDataTableFilterTransformValue(field);
        if (transformValue) {
            parts.push(transformValue);
        }
    }

    parts.push('                    }');
    return parts.join('\n');
}

function renderDataTableFilterControl(field, type) {
    return '';
}

function inferDataTableFilterType(field) {
    if (field.type === 'ManyToOne') return 'lookup';
    if (field.type === 'Boolean') return 'boolean';
    if (field.type === 'Enum') return 'select';
    if (field.type === 'Date') return 'date-range';
    if (field.type === 'DateTime' || field.type === 'Instant') return 'date';
    return 'text';
}

function dataTableFilterOperator(field) {
    if (['String', 'Text', 'MediumText'].includes(field.type)) return 'LIKE';
    return 'EQUALS';
}

function renderDataTableFilterOptions(field) {
    const configuredOptions = field.ui?.table?.filter?.options;
    if (configuredOptions?.length) {
        return `                        options: [
${configuredOptions.map((option) => `                            { label: "${option.label.replace(/"/g, '\\"')}", value: "${option.value.replace(/"/g, '\\"')}" },`).join('\n')}
                        ],`;
    }

    if (field.type === 'Boolean' || field.ui?.table?.filter?.type === 'boolean' || field.ui?.table?.filter?.type === 'toggle') {
        return `                        options: [
                            { label: t("common.filters.all"), value: "" },
                            { label: t("common.boolean.yes"), value: "true" },
                            { label: t("common.boolean.no"), value: "false" },
                        ],`;
    }

    if (field.type === 'Enum') {
        return `                        options: ${renderEnumFilterOptions(field)},`;
    }

    return '';
}

function renderDataTableFilterTransformValue(field) {
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) {
        return '                        transformValue: (value: string) => Number(value),';
    }

    if (field.type === 'Boolean' || field.ui?.table?.filter?.type === 'boolean' || field.ui?.table?.filter?.type === 'toggle') {
        return '                        transformValue: (value: string) => value === "true",';
    }

    return '';
}

function renderFieldHintProps(field) {
    const parts = [];
    if (field.tooltip) parts.push(`tooltip="${field.tooltip.replace(/"/g, '\\"')}"`);
    if (field.description) parts.push(`description="${field.description.replace(/"/g, '\\"')}"`);
    return parts.length ? ' ' + parts.join(' ') : '';
}

function renderDetailFields(ctx) {
    return ctx.detailFields.map((field) => `                        <div>
                            <dt className="text-sm font-medium text-muted-foreground">{t("${ctx.entityPluralKebab}.fields.${requestFieldName(field)}")}</dt>
                            <dd className="mt-1 text-sm">{String(${ctx.entityVar}.${responseFieldName(field)} ?? t("common.fallbackValue"))}</dd>
                        </div>`).join('\n\n');
}

function renderFormFields(ctx) {
    const allFields = uniqueByName([...ctx.createFields, ...ctx.updateFields]);

    return allFields.map((field) => {
        const fieldName = requestFieldName(field);
        const props = renderFieldProps(field);
        const label = `{t("${ctx.entityPluralKebab}.fields.${fieldName}")}`;

        if (field.type === 'Boolean') {
            return `                        <FormSwitch form={form} name="${fieldName}" label=${label}${props} />`;
        }

        if (field.type === 'Date') {
            return `                        <FormDatePicker form={form} name="${fieldName}" label=${label}${props} />`;
        }

        if (field.type === 'DateTime' || field.type === 'Instant') {
            return `                        <FormDateTimePicker form={form} name="${fieldName}" label=${label}${props} />`;
        }

        if (field.type === 'ManyToOne') {
            const entityLabel = lookupEntityLabelExpression(field, label.slice(1, -1));
            return `                        <FormLookupPicker
                            form={form}
                            name="${fieldName}"
                            label=${label}
                            lookup={${renderLookupConfigExpression(field)}}
                            placeholder={t("common.actions.selectEntity", { entity: ${entityLabel} })}
                            searchPlaceholder={t("common.search.byFields", { fields: ${entityLabel}.toLowerCase() })}
                            emptyMessage={t("common.empty.title", { entity: ${entityLabel} })}
                            ${props.trim()}
                        />`;
        }

        if (field.type === 'Enum') {
            return `                        <FormSelect form={form} name="${fieldName}" label=${label} options={${renderEnumOptions(field)}}${props} />`;
        }

        if (field.type === 'Text' || field.type === 'MediumText') {
            return `                        <FormTextarea form={form} name="${fieldName}" label=${label} rows={4} textareaClassName="min-h-28"${props} />`;
        }

        return `                        <FormInput form={form} name="${fieldName}" label=${label}${inputTypeAttr(field)}${props} />`;
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
        if (field.type === 'Text' || field.type === 'MediumText') imports.add('FormTextarea');
    }

    return [...imports].sort();
}

function renderTsField(field) {
    return `    ${responseFieldName(field)}: ${tsType(field)};`;
}

function renderTsRequestField(field) {
    return `    ${requestFieldName(field)}${field.required ? '' : '?'}: ${tsRequestType(field)};`;
}

function renderZodField(field, ctx) {
    const fieldLabel = `t("${ctx.entityPluralKebab}.fields.${requestFieldName(field)}")`;

    if (field.type === 'Boolean') {
        return field.required ? 'z.boolean()' : 'z.boolean().optional()';
    }

    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) {
        return field.required ? 'z.coerce.number()' : 'z.coerce.number().optional()';
    }

    if (field.type === 'Enum') {
        const values = field.enumValues?.length
            ? field.enumValues.map((value) => `"${escapeTsString(value)}"`).join(', ')
            : '';
        const enumSchema = values ? `z.enum([${values}])` : 'z.string()';
        return field.required ? enumSchema : `${enumSchema}.optional()`;
    }

    let chain = 'z.string()';

    if (field.validation?.email) {
        chain = chain.replace('z.string()', `z.string().email(t("validation.email", { field: ${fieldLabel} }))`);
    }

    if (field.required) {
        chain += `.min(1, t("validation.required", { field: ${fieldLabel} }))`;
    }

    if (field.validation?.minLength !== undefined) {
        chain += `.min(${field.validation.minLength}, t("validation.minLength", { field: ${fieldLabel}, min: ${field.validation.minLength} }))`;
    }

    if (field.validation?.maxLength !== undefined) {
        chain += `.max(${field.validation.maxLength}, t("validation.maxLength", { field: ${fieldLabel}, max: ${field.validation.maxLength} }))`;
    } else if (field.length) {
        chain += `.max(${field.length}, t("validation.maxLength", { field: ${fieldLabel}, max: ${field.length} }))`;
    }

    if (!field.required) {
        chain += '.optional()';
        return `z.preprocess((value) => value === "" ? undefined : value, ${chain})`;
    }

    return chain;
}

function renderResourceLocale(ctx) {
    const entries = [
        [`${ctx.entityPluralKebab}.names.singular`, _.startCase(ctx.entityVar)],
        [`${ctx.entityPluralKebab}.names.plural`, _.startCase(ctx.entityPlural)],
    ];

    for (const field of uniqueByName(ctx.fields)) {
        entries.push([`${ctx.entityPluralKebab}.fields.${requestFieldName(field)}`, labelForField(field)]);
    }

    return entries
        .map(([key, value]) => `    "${key}": "${String(value).replace(/"/g, '\\"')}",`)
        .join('\n');
}

function enumFields(ctx) {
    return uniqueByName(ctx.fields).filter((field) => field.type === 'Enum');
}

function renderEnumTypeAliases(ctx) {
    const aliases = new Map();

    for (const field of enumFields(ctx)) {
        if (!field.enumName || aliases.has(field.enumName)) {
            continue;
        }

        const values = field.enumValues?.length
            ? field.enumValues.map((value) => `"${escapeTsString(value)}"`).join(' | ')
            : 'string';
        aliases.set(field.enumName, `export type ${field.enumName} = ${values};`);
    }

    return [...aliases.values()].join('\n');
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

    const routeArrayBody = getRouteDefinitionArrayBody(content);
    const missingSpreads = routeRegistrations
        .filter((registration) => !routeArrayBody.includes(`...${registration.exportName}`))
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

function getRouteDefinitionArrayBody(content) {
    const match = content.match(/^export const \w+Routes: RouteDefinition\[\] = \[([\s\S]*?)\];/m);
    return match ? match[1] : '';
}

async function wireNestedChildTablesToParentPages(webDir, resources) {
    const changed = [];
    const nestedChildren = resources.filter((resource) =>
        resource.parent && resource.apiStyle === 'nested' && !resource.embedInParentDto,
    );

    for (const child of nestedChildren) {
        const childCtx = buildWebResourceContext(child);
        const parentVar = _.lowerFirst(child.parent);
        const parentName = _.upperFirst(_.camelCase(child.parent));
        const parentPluralKebab = _.kebabCase(pluralize(parentVar));
        const parentPagesDir = path.join(webDir, 'src', 'features', parentPluralKebab, 'pages');
        const detailFile = path.join(parentPagesDir, `${parentName}DetailPage.tsx`);
        const editFile = path.join(parentPagesDir, `${parentName}EditPage.tsx`);

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
    next = ensureNamedImport(next, 'react-router', ['useLocation', 'useNavigate']);
    next = ensureNamedImport(next, '@gasi/core-ui', ['Button', 'Card', 'CardContent', 'CardTabs', 'CardTabsContent', 'CardTabsList', 'CardTabsTrigger', 'ServerDataTable', 'appToast']);
    next = ensureNamedImport(next, 'lucide-react', ['Plus']);
    next = insertAfterImportBlock(next, `import { get${childCtx.entityName}Columns } from "../../${childCtx.entityPluralKebab}/components/${childCtx.entityName}Columns";`);
    next = insertAfterImportBlock(next, `import { useDelete${childCtx.entityName}, use${childCtx.entityPluralPascal}Page } from "../../${childCtx.entityPluralKebab}/hooks/use${childCtx.entityName}";`);

    if (!next.includes('const navigate = useNavigate();')) {
        next = next.replace(/(export function [^{]+{\n)/, `$1    const navigate = useNavigate();\n`);
    }
    if (!next.includes('const location = useLocation();')) {
        next = next.replace(/(const navigate = useNavigate\(\);\n)/, `$1    const location = useLocation();\n`);
    }

    const setup = renderNestedChildTableSetup(childCtx);
    if (!next.includes(`${childCtx.entityVar}ListPath`)) {
        if (/const \{ t \} = useI18n\(\);\n/.test(next)) {
            next = next.replace(/(const \{ t \} = useI18n\(\);\n)/, `$1${setup}`);
        } else {
            next = next.replace(/(const params = useParams\(\);\n)/, `$1${setup}`);
        }
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
    const ${childCtx.entityVar}BackTo = \`\${location.pathname}?tab=${childCtx.entityPluralKebab}\`;
    const delete${childCtx.entityName} = useDelete${childCtx.entityName}(params.id ?? "");
    const handle${childCtx.entityName}Delete = useCallback(async (id: string) => {
        try {
            await delete${childCtx.entityName}.mutateAsync(id);
            appToast.success(t("common.messages.deleteSuccess", { entity: t("${childCtx.entityPluralKebab}.names.singular") }));
        } catch (error) {
            appToast.error(error, t("common.messages.deleteError", { entity: t("${childCtx.entityPluralKebab}.names.singular") }));
        }
    }, [delete${childCtx.entityName}, t]);
    const ${childCtx.entityVar}PageQuery = useCallback((request: Parameters<typeof use${childCtx.entityPluralPascal}Page>[1]) =>
        use${childCtx.entityPluralPascal}Page(params.id ?? "", request), [params.id]);
    const ${childCtx.entityVar}Columns = useMemo(() => get${childCtx.entityName}Columns({
        basePath: ${childCtx.entityVar}ListPath,
        backTo: ${childCtx.entityVar}BackTo,
        onDelete: handle${childCtx.entityName}Delete,
        t,
    }), [${childCtx.entityVar}BackTo, ${childCtx.entityVar}ListPath, handle${childCtx.entityName}Delete, t]);
`;
}

function renderNestedChildTabTrigger(childCtx, marker) {
    return `                    {/* ${marker} */}
                    <CardTabsTrigger value="${childCtx.entityPluralKebab}">{t("${childCtx.entityPluralKebab}.names.plural")}</CardTabsTrigger>`;
}

function renderNestedChildTabContent(childCtx) {
    return `                <CardTabsContent value="${childCtx.entityPluralKebab}">
                    <Card>
                        <CardContent>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-semibold">{t("${childCtx.entityPluralKebab}.names.plural")}</h2>
                                    <p className="text-sm text-muted-foreground">{t("common.descriptions.manageEntityMasterData", { entity: t("${childCtx.entityPluralKebab}.names.plural") })}</p>
                                </div>
                                <Button type="button" onClick={() => navigate(\`\${${childCtx.entityVar}ListPath}/create?backTo=\${encodeURIComponent(${childCtx.entityVar}BackTo)}\`)}>
                                    <Plus className="size-4" />
                                    {t("common.actions.addEntity", { entity: t("${childCtx.entityPluralKebab}.names.singular") })}
                                </Button>
                            </div>
                            <ServerDataTable
                                columns={${childCtx.entityVar}Columns}
                                pageQuery={${childCtx.entityVar}PageQuery}
                                searchFields={${renderSearchFields(childCtx)}}
                                searchPlaceholder={t("common.search.byFields", { fields: t("${childCtx.entityPluralKebab}.names.plural").toLowerCase() })}
                                loadingTitle={t("common.loading.entity", { entity: t("${childCtx.entityPluralKebab}.names.plural") })}
                                emptyTitle={t("common.empty.title", { entity: t("${childCtx.entityPluralKebab}.names.plural") })}
                                emptyDescription={t("common.empty.createOrImportTemplate", { entity: t("${childCtx.entityPluralKebab}.names.singular") })}
                                enableColumnSettings
                                columnPreferenceKey="${childCtx.entityKebab}-embedded-table"
                                defaultVisibleColumns={${renderDefaultVisibleColumns(childCtx)}}
                            />
                        </CardContent>
                    </Card>
                </CardTabsContent>`;
}

function renderNestedChildTabsSection(childCtx, marker, generalContent) {
    return `
            {/* GASI_NESTED_CHILD_TABS */}
            <CardTabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "general"}>
                <CardTabsList>
                    <CardTabsTrigger value="general">{t("common.tabs.general")}</CardTabsTrigger>
${renderNestedChildTabTrigger(childCtx, marker)}
                </CardTabsList>
                <CardTabsContent value="general">
${generalContent.trimEnd()}
                </CardTabsContent>
${renderNestedChildTabContent(childCtx)}
            </CardTabs>`;
}

function insertNestedChildTableSection(content, childCtx, marker) {
    if (content.includes('GASI_NESTED_CHILD_TABS')) {
        let next = content;
        next = next.replace(
            /(\n\s*<\/CardTabsList>)/,
            `\n${renderNestedChildTabTrigger(childCtx, marker)}$1`,
        );
        next = next.replace(
            /(\n\s*<\/CardTabs>\s*)/,
            `\n${renderNestedChildTabContent(childCtx)}$1`,
        );
        return next;
    }

    const cardTabsMatch = content.match(/<CardTabs\b[^>]*>[\s\S]*?<\/CardTabs>/);
    if (!cardTabsMatch || cardTabsMatch.index === undefined) {
        return content;
    }

    let tabsBlock = cardTabsMatch[0]
        .replace('<CardTabs defaultValue="general"', '<CardTabs defaultValue={new URLSearchParams(window.location.search).get("tab") || "general"}');

    tabsBlock = tabsBlock.replace(
        /(\n\s*<CardTabsList>)/,
        `$1\n                    {/* GASI_NESTED_CHILD_TABS */}`,
    );
    tabsBlock = tabsBlock.replace(
        /(\n\s*<\/CardTabsList>)/,
        `\n${renderNestedChildTabTrigger(childCtx, marker)}$1`,
    );
    tabsBlock = tabsBlock.replace(
        /(\n\s*<\/CardTabs>\s*)$/,
        `\n${renderNestedChildTabContent(childCtx)}$1`,
    );

    return `${content.slice(0, cardTabsMatch.index)}${tabsBlock}${content.slice(cardTabsMatch.index + cardTabsMatch[0].length)}`;
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
        const parentName = _.upperFirst(_.camelCase(child.parent));
        const parentPluralKebab = _.kebabCase(pluralize(parentVar));
        const childFieldName = child.as || pluralize(_.lowerFirst(child.entityName));
        const baseDir = path.join(webDir, 'src', 'features', parentPluralKebab);

        const files = [
            path.join(baseDir, 'i18n', 'locales', 'en.ts'),
            path.join(baseDir, 'i18n', 'locales', 'id.ts'),
            path.join(baseDir, 'types', `${parentVar}.types.ts`),
            path.join(baseDir, 'schemas', `${parentVar}CreateSchema.ts`),
            path.join(baseDir, 'schemas', `${parentVar}UpdateSchema.ts`),
            path.join(baseDir, 'components', `${parentName}Form.tsx`),
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
    if (file.endsWith(path.join('i18n', 'locales', 'en.ts')) || file.endsWith(path.join('i18n', 'locales', 'id.ts'))) {
        return patchParentLocaleWithEmbeddedChild(content, childCtx);
    }

    if (file.endsWith('.types.ts')) {
        return patchParentTypesWithEmbeddedChild(content, childCtx, childFieldName);
    }

    if (file.endsWith('CreateSchema.ts') || file.endsWith('UpdateSchema.ts')) {
        return patchParentSchemaWithEmbeddedChild(content, childCtx, childFieldName);
    }

    if (file.endsWith('Form.tsx')) {
        return patchParentFormWithEmbeddedChild(content, childCtx, childFieldName);
    }

    return content;
}

function patchParentLocaleWithEmbeddedChild(content, childCtx) {
    const entries = embeddedChildLocaleEntries(childCtx)
        .filter(([key]) => !content.includes(`"${key}"`));

    if (!entries.length) {
        return content;
    }

    const rendered = entries
        .map(([key, value]) => `    "${key}": "${escapeTsString(value)}",`)
        .join('\n');

    return content.replace(/\n\};\s*$/, `\n${rendered}\n};`);
}

function embeddedChildLocaleEntries(childCtx) {
    const entries = [
        [`${childCtx.entityPluralKebab}.names.singular`, _.startCase(childCtx.entityVar)],
        [`${childCtx.entityPluralKebab}.names.plural`, _.startCase(childCtx.entityPlural)],
    ];

    for (const field of uniqueByName(childCtx.fields)) {
        entries.push([`${childCtx.entityPluralKebab}.fields.${requestFieldName(field)}`, labelForField(field)]);
    }

    return entries;
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
    return content
        .replace(/(return z\.object\(\{\n)/, `$1${schema}`)
        .replace(/(export const \w+(Create|Update)Schema = z\.object\(\{\n)/, `$1${schema}`);
}

function renderEmbeddedChildSchemaField(childCtx, childFieldName) {
    const fields = childCtx.resource.fields.map((field) =>
        `        ${requestFieldName(field)}: ${renderZodField(field, childCtx)},`).join('\n');
    return `    ${childFieldName}: z.array(z.object({\n${fields}\n    })).default([]),\n`;
}

function patchParentFormWithEmbeddedChild(content, childCtx, childFieldName) {
    const marker = `GASI_EMBEDDED_CHILD_TABLE: ${childFieldName}`;
    let next = ensureNamedImport(content, '@gasi/core-ui', ['FormArrayTable']);
    for (const ref of lookupRefEntities(childCtx.resource.fields)) {
        const importLine = `import { ${ref.varName}Lookup } from "../../${ref.pluralKebab}/lookups";`;
        if (!next.includes(importLine)) {
            next = insertAfterImportBlock(next, importLine);
        }
    }

    if (next.includes(marker)) {
        return upgradeEmbeddedChildLookupColumns(next, childCtx);
    }

    next = next.replace(
        /defaultValues: props\.defaultValues as Partial<(\w+)>,/,
        `defaultValues: { ${childFieldName}: [], ...props.defaultValues } as unknown as Partial<$1>,`,
    );

    const table = renderEmbeddedChildFormArrayTable(childCtx, childFieldName, marker);
    return next.replace(
        /(\n\s*<div className="flex justify-end gap-2 border-t pt-5">)/,
        `\n${table}$1`,
    );
}

function upgradeEmbeddedChildLookupColumns(content, childCtx) {
    let next = content;

    for (const field of childCtx.resource.fields.filter((item) => item.type === 'ManyToOne')) {
        const oneLineColumn = new RegExp(`\\s*\\{ name: "${escapeRegExp(requestFieldName(field))}", header: "${escapeRegExp(labelForField(field))}", type: "lookup", options: \\[\\] \\},`);
        next = next.replace(oneLineColumn, `\n${renderEmbeddedChildColumn(field)}`);
    }

    return next;
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
    if (!field.required) return 'undefined';
    if (field.type === 'Boolean') return 'false';
    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) return '0';
    return '""';
}

function renderEmbeddedChildColumns(childCtx) {
    return childCtx.resource.fields.map(renderEmbeddedChildColumn).join('\n');
}

function renderEmbeddedChildColumn(field) {
    const type = embeddedColumnType(field);
    if (field.type === 'ManyToOne') {
        const entityLabel = lookupEntityLabelExpression(field, `"${labelForField(field)}"`);
        return `                            {
                                name: "${requestFieldName(field)}",
                                header: "${labelForField(field)}",
                                type: "lookup",
                                lookup: ${renderLookupConfigExpression(field)},
                                placeholder: t("common.actions.selectEntity", { entity: ${entityLabel} }),
                                searchPlaceholder: t("common.search.byFields", { fields: ${entityLabel}.toLowerCase() }),
                                emptyMessage: t("common.empty.title", { entity: ${entityLabel} }),
                            },`;
    }

    const options = field.type === 'Enum'
        ? `, options: ${renderEnumOptions(field)}`
        : type === 'select' || type === 'lookup'
            ? ', options: []'
            : '';
    return `                            { name: "${requestFieldName(field)}", header: "${labelForField(field)}", type: "${type}"${options} },`;
}

function embeddedColumnType(field) {
    if (field.type === 'ManyToOne') return 'lookup';
    if (field.type === 'Enum') return 'select';
    if (field.type === 'Boolean') return 'switch';
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
    if (field.type === 'Enum') return field.enumName || 'string';
    return 'string';
}

function tsRequestType(field) {
    return tsType(field);
}

function labelForField(field) {
    return _.startCase(field.name);
}

function lookupEntityLabelExpression(field, fallbackExpression) {
    if (!field.refEntity) {
        return fallbackExpression;
    }

    return `t("${_.kebabCase(pluralize(_.lowerFirst(field.refEntity)))}.names.singular")`;
}

function enumOptionLabel(value) {
    return _.startCase(String(value).toLowerCase().replace(/_/g, ' '));
}

function renderEnumOptions(field) {
    const configuredOptions = field.ui?.table?.filter?.options;
    const options = configuredOptions?.length
        ? configuredOptions
        : (field.enumValues ?? []).map((value) => ({
            label: enumOptionLabel(value),
            value,
        }));

    return `[${options
        .map((option) => `{ label: "${escapeTsString(option.label)}", value: "${escapeTsString(option.value)}" }`)
        .join(', ')}]`;
}

function renderEnumFilterOptions(field) {
    const enumOptions = renderEnumOptions(field);
    return `[{ label: t("common.filters.all"), value: "" }, ...${enumOptions}]`;
}

function escapeTsString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isDtoIncluded(field, dtoName) {
    return !field.dto || field.dto[dtoName] !== false;
}

function uniqueByName(fields) {
    return [...new Map(fields.map((field) => [requestFieldName(field), field])).values()];
}

module.exports = { generateWebResources };
