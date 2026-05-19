import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { DataTable } from "@/components/datatable/data-table";
import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { PageHeader } from "@/components/molecules/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { get{{ENTITY_NAME}}Columns } from "../components/{{ENTITY_KEBAB}}-columns";
import { useDelete{{ENTITY_NAME}}, use{{ENTITY_PLURAL_PASCAL}} } from "../hooks/use{{ENTITY_PLURAL_PASCAL}}";

export function {{ENTITY_NAME}}ListPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const {{ENTITY_PLURAL}}Query = use{{ENTITY_PLURAL_PASCAL}}();
    const delete{{ENTITY_NAME}} = useDelete{{ENTITY_NAME}}();
    const data = {{ENTITY_PLURAL}}Query.data ?? [];

    const handleDelete = (id: string) => {
        delete{{ENTITY_NAME}}.mutate(id);
    };

    const handleBulkDelete = (ids: string[]) => {
        ids.forEach((id) => delete{{ENTITY_NAME}}.mutate(id));
    };

    const columns = useMemo(
        () =>
            get{{ENTITY_NAME}}Columns({
                onDelete: handleDelete,
            }),
        [],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="{{ENTITY_PLURAL_PASCAL}}" description="Manage {{ENTITY_PLURAL_TITLE}}." />

            <Card>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={data}
                        searchPlaceholder="Search {{ENTITY_PLURAL}}..."
                        emptyTitle={{{ENTITY_PLURAL}}Query.isLoading ? "Loading {{ENTITY_PLURAL_TITLE}}..." : "No {{ENTITY_PLURAL_TITLE}} found"}
                        emptyDescription={{{ENTITY_PLURAL}}Query.isError ? "Unable to load data from API." : "Create a new {{ENTITY_VAR_TITLE}} to get started."}
                        searchValue={search}
                        onSearchChange={setSearch}
                        enableColumnSettings
                        columnPreferenceKey="{{ENTITY_KEBAB}}-table"
                        primaryAction={{
                            label: "Add {{ENTITY_VAR_TITLE}}",
                            icon: <Plus className="size-4" />,
                            onClick: () => navigate("{{ROUTE_PATH}}/create"),
                        }}
                        enableRowSelection
                        getRowId={(row) => row.id}
                        renderSelectedActions={(selectedRows) => (
                            <ConfirmDialog
                                destructive
                                title="Delete selected {{ENTITY_PLURAL}}?"
                                description={`You are about to delete ${selectedRows.length} {{ENTITY_PLURAL}}. This action cannot be undone.`}
                                confirmLabel="Delete"
                                trigger={
                                    <Button type="button" variant="destructive" size="sm">
                                        <Trash2 className="size-4" />
                                        Delete selected
                                    </Button>
                                }
                                onConfirm={() => handleBulkDelete(selectedRows.map((row) => row.id))}
                            />
                        )}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
