{{LIST_ICON_IMPORTS}}
{{LIST_REACT_IMPORT}}
{{LIST_ROUTER_IMPORT}}

{{LIST_CORE_API_IMPORTS}}
{{LIST_STORE_IMPORT}}
{{LIST_TYPE_IMPORTS}}
{{LIST_BULK_DELETE_IMPORT}}
{{LIST_FILTER_IMPORTS}}
{{LIST_LOOKUP_IMPORTS}}
{{LIST_BUTTON_IMPORT}}
import { ResourceListPage, getResourceCustom, useI18n } from "@gasi/core-ui";
{{LIST_TOAST_IMPORT}}
import { get{{ENTITY_NAME}}Columns } from "../components/{{ENTITY_NAME}}Columns";
import { {{LIST_DELETE_IMPORT}} } from "../hooks/use{{ENTITY_NAME}}";

{{LIST_CUSTOM_TYPE}}

export function {{ENTITY_NAME}}ListPage() {
{{LIST_NAVIGATE_SETUP}}
    const { t } = useI18n();
    const custom = getResourceCustom<{{ENTITY_NAME}}ListCustom>("{{ENTITY_VAR}}");
{{LIST_PARENT_SETUP}}
{{LIST_PERMISSIONS}}
{{ADVANCED_FILTER_STATE}}
    const pluralEntity = t("{{I18N_KEY_PREFIX}}.names.plural");

{{LIST_DELETE_HANDLERS}}
{{LIST_BULK_UPLOAD_HANDLER}}
{{ADVANCED_FILTER_LOGIC}}

    const columns = useMemo(
        () => {
            const baseColumns = get{{ENTITY_NAME}}Columns({
            {{LIST_COLUMNS_CONFIG}}
            });

            return custom.list?.columns?.(baseColumns) ?? baseColumns;
        },
        {{LIST_COLUMNS_DEPS}},
    );
{{LIST_PAGE_QUERY}}
{{LIST_HEADER_ACTIONS_SETUP}}

    return (
        <ResourceListPage
            title={pluralEntity}
            description={t("common.descriptions.manageEntityMasterData", { entity: pluralEntity })}
            {{LIST_BREADCRUMBS}}
            actions={headerActions}
            columns={columns}
            table={{
                {{PAGE_QUERY_PROP}}
                searchFields: {{SEARCH_FIELDS}},
                {{DATATABLE_FILTERS}}
                searchPlaceholder: t("common.search.byFields", { fields: pluralEntity.toLowerCase() }),
                loadingTitle: t("common.loading.entity", { entity: pluralEntity }),
                emptyTitle: t("common.empty.title", { entity: pluralEntity }),
                emptyDescription: t("common.empty.createOrImportTemplate", { entity: pluralEntity }),
                emptyState: {
                    title: t("common.empty.title", { entity: pluralEntity }),
                    description: t("common.empty.createOrImportTemplate", { entity: pluralEntity }),
                },
                filteredEmptyState: {
                    title: t("common.empty.filteredTitle", { entity: pluralEntity }),
                    description: t("common.empty.filteredDescription", { entity: pluralEntity }),
                },
                enableCsvExport: canDownload,
                csvFileName: "{{ENTITY_PLURAL_KEBAB}}",
                enableColumnSettings: true,
                columnPreferenceKey: "{{ENTITY_KEBAB}}-table",
                defaultVisibleColumns: {{DEFAULT_VISIBLE_COLUMNS}},
                entityLabel: pluralEntity,
                {{LIST_ROW_SELECTION_PROPS}}
            }}
        />
    );
}
