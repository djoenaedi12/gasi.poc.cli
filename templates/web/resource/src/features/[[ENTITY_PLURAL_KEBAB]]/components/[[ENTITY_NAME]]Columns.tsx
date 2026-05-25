import type { ColumnDef } from "@tanstack/react-table";

{{COLUMN_ACTION_IMPORT}}
import type { Translate } from "@gasi/core-ui";
import type { {{ENTITY_NAME}}Summary } from "../types/{{ENTITY_VAR}}.types";

type {{ENTITY_NAME}}ColumnsOptions = {
{{COLUMN_OPTIONS}}
};

export function get{{ENTITY_NAME}}Columns({
{{COLUMN_PARAMS}}
}: {{ENTITY_NAME}}ColumnsOptions): ColumnDef<{{ENTITY_NAME}}Summary>[] {
    return [
{{COLUMN_FIELDS}}
{{COLUMN_ACTION_ITEM}}
    ];
}
