import { Plus, Upload } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";

import { DataTableBulkDeleteAction } from "@gasi/core-ui";
import { ServerDataTable } from "@gasi/core-ui";
import { PageHeader } from "@gasi/core-ui";
import { Button } from "@gasi/core-ui";
import { Card, CardContent } from "@gasi/core-ui";
import { get{{ENTITY_NAME}}Columns } from "../components/{{ENTITY_KEBAB}}-columns";
import { useDelete{{ENTITY_NAME}}, use{{ENTITY_PLURAL_PASCAL}}Page } from "../hooks/use-{{ENTITY_KEBAB}}";

export function {{ENTITY_NAME}}ListPage() {
    const navigate = useNavigate();
    const delete{{ENTITY_NAME}} = useDelete{{ENTITY_NAME}}();

    const handleDelete = useCallback((id: string) => {
        delete{{ENTITY_NAME}}.mutate(id);
    }, [delete{{ENTITY_NAME}}]);

    const handleBulkDelete = useCallback((ids: string[]) => {
        ids.forEach((id) => delete{{ENTITY_NAME}}.mutate(id));
    }, [delete{{ENTITY_NAME}}]);

    const handleBulkUpload = useCallback(() => {
        console.log("Open {{ENTITY_PLURAL_TITLE}} bulk upload flow");
    }, []);

    const columns = useMemo(
        () => get{{ENTITY_NAME}}Columns({ onDelete: handleDelete }),
        [handleDelete],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="{{ENTITY_PLURAL_PASCAL}}" description="Manage {{ENTITY_PLURAL_TITLE}}." />

            <Card>
                <CardContent>
                    <ServerDataTable
                        columns={columns}
                        pageQuery={use{{ENTITY_PLURAL_PASCAL}}Page}
                        searchFields={{{SEARCH_FIELDS}}}
                        searchPlaceholder="Search {{ENTITY_PLURAL}}..."
                        loadingTitle="Loading {{ENTITY_PLURAL_TITLE}}..."
                        emptyTitle="No {{ENTITY_PLURAL_TITLE}} found"
                        emptyDescription="Create a new {{ENTITY_VAR_TITLE}} to get started."
                        emptyAction={
                            <>
                                <Button type="button" onClick={() => navigate("{{ROUTE_PATH}}/create")}>
                                    <Plus className="size-4" />
                                    Create {{ENTITY_VAR_TITLE}}
                                </Button>

                                <Button type="button" variant="outline" onClick={handleBulkUpload}>
                                    <Upload className="size-4" />
                                    Bulk Upload
                                </Button>
                            </>
                        }
                        enableCsvExport
                        csvFileName="{{ENTITY_PLURAL_KEBAB}}"
                        enableColumnSettings
                        columnPreferenceKey="{{ENTITY_KEBAB}}-table"
                        defaultVisibleColumns={{{DEFAULT_VISIBLE_COLUMNS}}}
                        primaryAction={{
                            label: "Add {{ENTITY_VAR_TITLE}}",
                            icon: <Plus className="size-4" />,
                            items: [
                                {
                                    label: "Add {{ENTITY_VAR_TITLE}}",
                                    icon: <Plus className="size-4" />,
                                    onClick: () => navigate("{{ROUTE_PATH}}/create"),
                                },
                                {
                                    label: "Bulk Upload",
                                    icon: <Upload className="size-4" />,
                                    onClick: handleBulkUpload,
                                },
                            ],
                        }}
                        enableRowSelection
                        getRowId={(row) => row.id}
                        renderSelectedActions={(selectedRows) => (
                            <DataTableBulkDeleteAction
                                selectedRows={selectedRows}
                                entityName="{{ENTITY_PLURAL}}"
                                getRowId={(row) => row.id}
                                onDelete={handleBulkDelete}
                            />
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
