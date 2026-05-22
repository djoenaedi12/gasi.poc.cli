{{LIST_ICON_IMPORTS}}
{{LIST_REACT_IMPORT}}
{{LIST_ROUTER_IMPORT}}

{{LIST_CORE_API_IMPORTS}}
{{LIST_STORE_IMPORT}}
{{LIST_TYPE_IMPORTS}}
{{LIST_BULK_DELETE_IMPORT}}
{{LIST_FILTER_IMPORTS}}
import { ServerDataTable } from "@gasi/core-ui";
import { PageHeader } from "@gasi/core-ui";
{{LIST_BUTTON_IMPORT}}
import { Card, CardContent } from "@gasi/core-ui";
import { get{{ENTITY_NAME}}Columns } from "../components/{{ENTITY_NAME}}Columns";
import { {{LIST_DELETE_IMPORT}} } from "../hooks/use{{ENTITY_NAME}}";

export function {{ENTITY_NAME}}ListPage() {
{{LIST_NAVIGATE_SETUP}}
{{LIST_PARENT_SETUP}}
{{LIST_PERMISSIONS}}
{{ADVANCED_FILTER_STATE}}

{{LIST_DELETE_HANDLERS}}
{{LIST_BULK_UPLOAD_HANDLER}}
{{ADVANCED_FILTER_LOGIC}}

    const columns = useMemo(
        () => get{{ENTITY_NAME}}Columns({
            {{LIST_COLUMNS_CONFIG}}
        }),
        {{LIST_COLUMNS_DEPS}},
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="{{ENTITY_PLURAL_PASCAL}}"
                description="Manage {{ENTITY_PLURAL_TITLE}}."
                {{LIST_HEADER_ACTIONS}}
            />

            <Card>
                <CardContent>
                    <ServerDataTable
                        columns={columns}
                        {{PAGE_QUERY_PROP}}
                        searchFields={{{SEARCH_FIELDS}}}
                        {{MORE_FILTER_PROPS}}
                        searchPlaceholder="Search {{ENTITY_PLURAL}}..."
                        loadingTitle="Loading {{ENTITY_PLURAL_TITLE}}..."
                        emptyTitle="No {{ENTITY_PLURAL_TITLE}} found"
                        enableCsvExport={canDownload}
                        csvFileName="{{ENTITY_PLURAL_KEBAB}}"
                        enableColumnSettings
                        columnPreferenceKey="{{ENTITY_KEBAB}}-table"
                        defaultVisibleColumns={{{DEFAULT_VISIBLE_COLUMNS}}}
                        {{LIST_ROW_SELECTION_PROPS}}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
