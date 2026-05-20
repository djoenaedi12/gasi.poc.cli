import { Plus, Upload } from "lucide-react";
import { useCallback, useMemo } from "react";
import { {{LIST_ROUTER_IMPORTS}} } from "react-router";

import { Actions } from "@gasi/core-api";
import { useAppStore } from "@gasi/core-starter";
import { DataTableBulkDeleteAction } from "@gasi/core-ui";
import { ServerDataTable } from "@gasi/core-ui";
import { PageHeader } from "@gasi/core-ui";
import { Button } from "@gasi/core-ui";
import { Card, CardContent } from "@gasi/core-ui";
import { get{{ENTITY_NAME}}Columns } from "../components/{{ENTITY_KEBAB}}-columns";
import { useDelete{{ENTITY_NAME}}, use{{ENTITY_PLURAL_PASCAL}}Page } from "../hooks/use-{{ENTITY_KEBAB}}";

export function {{ENTITY_NAME}}ListPage() {
    const navigate = useNavigate();
{{LIST_PARENT_SETUP}}
    const hasPermission = useAppStore((state) => state.hasPermission);
    const delete{{ENTITY_NAME}} = useDelete{{ENTITY_NAME}}({{DELETE_HOOK_ARGS}});
    const canCreate = hasPermission(`{{ENTITY_VAR}}:${Actions.CREATE}`);
    const canUpdate = hasPermission(`{{ENTITY_VAR}}:${Actions.UPDATE}`);
    const canDelete = hasPermission(`{{ENTITY_VAR}}:${Actions.DELETE}`);
    const canDownload = hasPermission(`{{ENTITY_VAR}}:${Actions.DOWNLOAD}`);
    const canUpload = hasPermission(`{{ENTITY_VAR}}:${Actions.UPLOAD}`);

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
        () => get{{ENTITY_NAME}}Columns({
            {{COLUMNS_BASE_PATH_ARG}}
            onDelete: canDelete ? handleDelete : undefined,
            showEdit: canUpdate,
            showDelete: canDelete,
        }),
        [canDelete, canUpdate, handleDelete],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="{{ENTITY_PLURAL_PASCAL}}" description="Manage {{ENTITY_PLURAL_TITLE}}." />

            <Card>
                <CardContent>
                    <ServerDataTable
                        columns={columns}
                        {{PAGE_QUERY_PROP}}
                        searchFields={{{SEARCH_FIELDS}}}
                        searchPlaceholder="Search {{ENTITY_PLURAL}}..."
                        loadingTitle="Loading {{ENTITY_PLURAL_TITLE}}..."
                        emptyTitle="No {{ENTITY_PLURAL_TITLE}} found"
                        emptyDescription="Create a new {{ENTITY_VAR_TITLE}} to get started."
                        emptyAction={
                            <>
                                {canCreate ? (
                                    <Button type="button" onClick={() => navigate({{NAVIGATE_CREATE}})}>
                                        <Plus className="size-4" />
                                        Create {{ENTITY_VAR_TITLE}}
                                    </Button>
                                ) : null}

                                {canUpload ? (
                                    <Button type="button" variant="outline" onClick={handleBulkUpload}>
                                        <Upload className="size-4" />
                                        Bulk Upload
                                    </Button>
                                ) : null}
                            </>
                        }
                        enableCsvExport={canDownload}
                        csvFileName="{{ENTITY_PLURAL_KEBAB}}"
                        enableColumnSettings
                        columnPreferenceKey="{{ENTITY_KEBAB}}-table"
                        defaultVisibleColumns={{{DEFAULT_VISIBLE_COLUMNS}}}
                        primaryAction={canCreate || canUpload ? {
                            label: "Add {{ENTITY_VAR_TITLE}}",
                            icon: <Plus className="size-4" />,
                            items: [
                                {
                                    label: "Add {{ENTITY_VAR_TITLE}}",
                                    icon: <Plus className="size-4" />,
                                    onClick: () => navigate({{NAVIGATE_CREATE}}),
                                    hidden: !canCreate,
                                },
                                {
                                    label: "Bulk Upload",
                                    icon: <Upload className="size-4" />,
                                    onClick: handleBulkUpload,
                                    hidden: !canUpload,
                                },
                            ],
                        } : undefined}
                        enableRowSelection={canDelete}
                        getRowId={(row) => row.id}
                        renderSelectedActions={canDelete ? (selectedRows) => (
                            <DataTableBulkDeleteAction
                                selectedRows={selectedRows}
                                entityName="{{ENTITY_PLURAL}}"
                                getRowId={(row) => row.id}
                                onDelete={handleBulkDelete}
                            />
                        ) : undefined}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
