import type { ColumnDef } from "@tanstack/react-table";

import { getDataTableRowActionsColumn } from "@gasi/core-ui";
import type { {{ENTITY_NAME}}Summary } from "../types/{{ENTITY_KEBAB}}.types";

type {{ENTITY_NAME}}ColumnsOptions = {
    basePath?: string;
    onDelete?: (id: string) => void;
    showEdit?: boolean;
    showDelete?: boolean;
};

export function get{{ENTITY_NAME}}Columns({
    basePath = "{{ROUTE_PATH}}",
    onDelete,
    showEdit = true,
    showDelete = true,
}: {{ENTITY_NAME}}ColumnsOptions = {}): ColumnDef<{{ENTITY_NAME}}Summary>[] {
    return [
{{COLUMN_FIELDS}}
        getDataTableRowActionsColumn({
            basePath,
            entityName: "{{ENTITY_VAR_TITLE}}",
            getRowId: ({{ENTITY_VAR}}) => {{ENTITY_VAR}}.id,
            onDelete: onDelete ? (id) => onDelete(id) : undefined,
            showEdit,
            showDelete,
        }),
    ];
}
