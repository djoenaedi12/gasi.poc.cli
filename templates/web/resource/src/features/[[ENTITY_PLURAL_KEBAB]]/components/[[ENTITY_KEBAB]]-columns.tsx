import type { ColumnDef } from "@tanstack/react-table";

import { getDataTableRowActionsColumn } from "@gasi/core-ui";
import type { {{ENTITY_NAME}}Summary } from "../types/{{ENTITY_KEBAB}}.types";

type {{ENTITY_NAME}}ColumnsOptions = {
    onDelete?: (id: string) => void;
};

export function get{{ENTITY_NAME}}Columns({
    onDelete,
}: {{ENTITY_NAME}}ColumnsOptions = {}): ColumnDef<{{ENTITY_NAME}}Summary>[] {
    return [
{{COLUMN_FIELDS}}
        getDataTableRowActionsColumn({
            basePath: "{{ROUTE_PATH}}",
            entityName: "{{ENTITY_VAR_TITLE}}",
            getRowId: ({{ENTITY_VAR}}) => {{ENTITY_VAR}}.id,
            onDelete: onDelete ? (id) => onDelete(id) : undefined,
        }),
    ];
}
