import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { Link } from "react-router";

import { ConfirmDialog } from "@/components/molecules/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { {{ENTITY_NAME}}Summary } from "../types/{{ENTITY_KEBAB}}.types";

type {{ENTITY_NAME}}ColumnsOptions = {
    onDelete?: (id: string) => void;
};

function {{ENTITY_NAME}}RowActions({
    {{ENTITY_VAR}},
    onDelete,
}: {{ENTITY_NAME}}ColumnsOptions & {
    {{ENTITY_VAR}}: {{ENTITY_NAME}}Summary;
}) {
    return (
        <div className="flex justify-end">
            <DropdownMenu>
                <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Open row actions</span>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                    <DropdownMenuGroup>
                        <DropdownMenuItem render={<Link to={`{{ROUTE_PATH}}/${{{ENTITY_VAR}}.id}`} />}>
                            <Eye className="size-4" />
                            View detail
                        </DropdownMenuItem>

                        <DropdownMenuItem render={<Link to={`{{ROUTE_PATH}}/${{{ENTITY_VAR}}.id}/edit`} />}>
                            <Edit className="size-4" />
                            Edit
                        </DropdownMenuItem>

                        <ConfirmDialog
                            destructive
                            title="Delete {{ENTITY_VAR_TITLE}}?"
                            description="This action cannot be undone."
                            confirmLabel="Delete"
                            trigger={
                                <DropdownMenuItem variant="destructive" disabled={!onDelete}>
                                    <Trash2 className="size-4" />
                                    Delete
                                </DropdownMenuItem>
                            }
                            onConfirm={() => onDelete?.({{ENTITY_VAR}}.id)}
                        />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function get{{ENTITY_NAME}}Columns({
    onDelete,
}: {{ENTITY_NAME}}ColumnsOptions = {}): ColumnDef<{{ENTITY_NAME}}Summary>[] {
    return [
{{COLUMN_FIELDS}}
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <{{ENTITY_NAME}}RowActions {{ENTITY_VAR}}={row.original} onDelete={onDelete} />
            ),
            enableSorting: false,
            enableHiding: false,
            meta: {
                label: "Actions",
                className: "w-12 min-w-12 max-w-12 px-0",
            },
        },
    ];
}
