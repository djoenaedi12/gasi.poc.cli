const _ = require('lodash');
const pluralize = require('pluralize');
const path = require('path');
const fs = require('fs-extra');

const FORM_IMPORT_PATHS = {
    FormCheckbox: 'form-checkbox',
    FormDatePicker: 'form-date-picker',
    FormDateTimePicker: 'form-datetime-picker',
    FormInput: 'form-input',
    FormLookupPicker: 'form-lookup-picker',
    FormSelect: 'form-select',
};

async function generateWebResources({ webDir, resources, force = false }) {
    await assertWebProjectRoot(webDir);

    const generatedFiles = [];

    for (const resource of resources) {
        const ctx = buildWebResourceContext(resource);
        const files = buildWebResourceFiles(ctx);

        for (const file of files) {
            const targetPath = path.join(webDir, file.path);

            if (!force && await fs.pathExists(targetPath)) {
                throw new Error(`File already exists: ${targetPath}. Use --web-force to overwrite.`);
            }
        }

        for (const file of files) {
            const targetPath = path.join(webDir, file.path);
            await fs.ensureDir(path.dirname(targetPath));
            await fs.writeFile(targetPath, normalizeTs(file.content), 'utf8');
            generatedFiles.push(targetPath);
        }
    }

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
    const featureDir = `src/features/${_.kebabCase(entityPlural)}`;
    const routePath = `/${_.kebabCase(entityPlural)}`;
    const fields = resource.fields;

    return {
        resource,
        entityName,
        entityVar,
        entityKebab,
        entityPlural,
        entityPluralPascal,
        featureDir,
        routePath,
        fields,
        createFields: fields.filter((field) => isDtoIncluded(field, 'create')),
        updateFields: fields.filter((field) => isDtoIncluded(field, 'update')),
        summaryFields: fields.filter((field) => isDtoIncluded(field, 'summary')),
        detailFields: fields.filter((field) => isDtoIncluded(field, 'detail')),
        filterFields: fields.filter((field) => field.filterable),
    };
}

function buildWebResourceFiles(ctx) {
    return [
        {
            path: `${ctx.featureDir}/types/${ctx.entityKebab}.types.ts`,
            content: renderTypes(ctx),
        },
        {
            path: `${ctx.featureDir}/schemas/${ctx.entityKebab}CreateSchema.ts`,
            content: renderSchema(ctx, 'create'),
        },
        {
            path: `${ctx.featureDir}/schemas/${ctx.entityKebab}UpdateSchema.ts`,
            content: renderSchema(ctx, 'update'),
        },
        {
            path: `${ctx.featureDir}/services/${ctx.entityKebab}Service.ts`,
            content: renderService(ctx),
        },
        {
            path: `${ctx.featureDir}/components/${ctx.entityName}Form.tsx`,
            content: renderForm(ctx),
        },
        {
            path: `${ctx.featureDir}/components/${ctx.entityKebab}-columns.tsx`,
            content: renderColumns(ctx),
        },
        {
            path: `${ctx.featureDir}/pages/${ctx.entityName}ListPage.tsx`,
            content: renderListPage(ctx),
        },
        {
            path: `${ctx.featureDir}/pages/${ctx.entityName}CreatePage.tsx`,
            content: renderCreatePage(ctx),
        },
        {
            path: `${ctx.featureDir}/pages/${ctx.entityName}EditPage.tsx`,
            content: renderEditPage(ctx),
        },
        {
            path: `${ctx.featureDir}/pages/${ctx.entityName}DetailPage.tsx`,
            content: renderDetailPage(ctx),
        },
        {
            path: `${ctx.featureDir}/routes.tsx`,
            content: renderRoutes(ctx),
        },
    ];
}

function renderTypes(ctx) {
    return `export type ${ctx.entityName}Summary = {
    id: string;
${ctx.summaryFields.map((field) => renderTsField(field)).join('\n')}
};

export type ${ctx.entityName}Detail = {
    id: string;
${ctx.detailFields.map((field) => renderTsField(field)).join('\n')}
};

export type ${ctx.entityName}CreateRequest = {
${ctx.createFields.map((field) => renderTsRequestField(field)).join('\n')}
};

export type ${ctx.entityName}UpdateRequest = {
${ctx.updateFields.map((field) => renderTsRequestField(field)).join('\n')}
};
`;
}

function renderSchema(ctx, kind) {
    const schemaName = `${ctx.entityVar}${_.upperFirst(kind)}Schema`;
    const typeName = `${ctx.entityName}${_.upperFirst(kind)}FormData`;
    const fields = kind === 'create' ? ctx.createFields : ctx.updateFields;

    return `import { z } from "zod";

export const ${schemaName} = z.object({
${fields.map((field) => `    ${requestFieldName(field)}: ${renderZodField(field)},`).join('\n')}
});

export type ${typeName} = z.infer<typeof ${schemaName}>;
`;
}

function renderService(ctx) {
    return `import { api } from "@/lib/axios";
import type {
    ${ctx.entityName}CreateRequest,
    ${ctx.entityName}Detail,
    ${ctx.entityName}Summary,
    ${ctx.entityName}UpdateRequest,
} from "../types/${ctx.entityKebab}.types";

const basePath = "${ctx.routePath}";

export const ${ctx.entityVar}Service = {
    list: (params?: Record<string, unknown>) =>
        api.get<${ctx.entityName}Summary[]>(basePath, { params }).then((response) => response.data),

    detail: (id: string) =>
        api.get<${ctx.entityName}Detail>(\`\${basePath}/\${id}\`).then((response) => response.data),

    create: (data: ${ctx.entityName}CreateRequest) =>
        api.post<${ctx.entityName}Detail>(basePath, data).then((response) => response.data),

    update: (id: string, data: ${ctx.entityName}UpdateRequest) =>
        api.put<${ctx.entityName}Detail>(\`\${basePath}/\${id}\`, data).then((response) => response.data),

    delete: (id: string) =>
        api.delete<void>(\`\${basePath}/\${id}\`).then((response) => response.data),
};
`;
}

function renderForm(ctx) {
    const createType = `${ctx.entityName}CreateFormData`;
    const updateType = `${ctx.entityName}UpdateFormData`;
    const formImports = collectFormImports(ctx);

    return `import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
${formImports.map((item) => `import { ${item} } from "@/components/molecules/${FORM_IMPORT_PATHS[item]}";`).join('\n')}
import {
    ${ctx.entityVar}CreateSchema,
    type ${createType},
} from "../schemas/${ctx.entityKebab}CreateSchema";
import {
    ${ctx.entityVar}UpdateSchema,
    type ${updateType},
} from "../schemas/${ctx.entityKebab}UpdateSchema";

type ${ctx.entityName}FormProps =
    | {
        mode: "create";
        defaultValues?: Partial<${createType}>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: ${createType}) => void | Promise<void>;
    }
    | {
        mode: "edit";
        defaultValues?: Partial<${updateType}>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: ${updateType}) => void | Promise<void>;
    };

export function ${ctx.entityName}Form(props: ${ctx.entityName}FormProps) {
    const form = useForm({
        resolver: zodResolver(props.mode === "create" ? ${ctx.entityVar}CreateSchema : ${ctx.entityVar}UpdateSchema),
        defaultValues: props.defaultValues,
    });

    return (
        <Card>
            <CardContent>
                <form onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
${renderFormFields(ctx)}
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-5">
                        <Button type="button" variant="outline" onClick={props.onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit">{props.submitLabel}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
`;
}

function renderColumns(ctx) {
    const displayFields = ctx.summaryFields.slice(0, 5);

    return `import type { ColumnDef } from "@tanstack/react-table";
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
import type { ${ctx.entityName}Summary } from "../types/${ctx.entityKebab}.types";

type ${ctx.entityName}ColumnsOptions = {
    onDelete?: (id: string) => void;
};

function ${ctx.entityName}RowActions({
    ${ctx.entityVar},
    onDelete,
}: ${ctx.entityName}ColumnsOptions & {
    ${ctx.entityVar}: ${ctx.entityName}Summary;
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
                        <DropdownMenuItem render={<Link to={\`${ctx.routePath}/\${${ctx.entityVar}.id}\`} />}>
                            <Eye className="size-4" />
                            View detail
                        </DropdownMenuItem>

                        <DropdownMenuItem render={<Link to={\`${ctx.routePath}/\${${ctx.entityVar}.id}/edit\`} />}>
                            <Edit className="size-4" />
                            Edit
                        </DropdownMenuItem>

                        <ConfirmDialog
                            destructive
                            title="Delete ${_.startCase(ctx.entityVar)}?"
                            description="This action cannot be undone."
                            confirmLabel="Delete"
                            trigger={
                                <DropdownMenuItem variant="destructive" disabled={!onDelete}>
                                    <Trash2 className="size-4" />
                                    Delete
                                </DropdownMenuItem>
                            }
                            onConfirm={() => onDelete?.(${ctx.entityVar}.id)}
                        />
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

export function get${ctx.entityName}Columns({
    onDelete,
}: ${ctx.entityName}ColumnsOptions = {}): ColumnDef<${ctx.entityName}Summary>[] {
    return [
${displayFields.map((field) => `        {
            accessorKey: "${responseFieldName(field)}",
            header: "${labelForField(field)}",
            meta: { label: "${labelForField(field)}" },
        },`).join('\n')}
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <${ctx.entityName}RowActions ${ctx.entityVar}={row.original} onDelete={onDelete} />
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
`;
}

function renderListPage(ctx) {
    return `import { useMemo, useState } from "react";

import { DataTable } from "@/components/datatable/DataTable";
import { PageHeader } from "@/components/molecules/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { get${ctx.entityName}Columns } from "../components/${ctx.entityKebab}-columns";
import type { ${ctx.entityName}Summary } from "../types/${ctx.entityKebab}.types";

const data: ${ctx.entityName}Summary[] = [];

export function ${ctx.entityName}ListPage() {
    const [search, setSearch] = useState("");
    const columns = useMemo(
        () =>
            get${ctx.entityName}Columns({
                onDelete: (id) => console.log("Delete ${ctx.entityName}", id),
            }),
        [],
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="${ctx.entityPluralPascal}" description="Manage ${_.startCase(ctx.entityPlural)}." />

            <Card>
                <CardContent>
                    <DataTable
                        columns={columns}
                        data={data}
                        searchPlaceholder="Search ${ctx.entityPlural}..."
                        searchValue={search}
                        onSearchChange={setSearch}
                        enableColumnSettings
                        columnPreferenceKey="${ctx.entityKebab}-table"
                        enableRowSelection
                        getRowId={(row) => row.id}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
`;
}

function renderCreatePage(ctx) {
    return `import { useNavigate } from "react-router";

import { PageHeader } from "@/components/molecules/page-header";
import { ${ctx.entityName}Form } from "../components/${ctx.entityName}Form";
import type { ${ctx.entityName}CreateFormData } from "../schemas/${ctx.entityKebab}CreateSchema";

export function ${ctx.entityName}CreatePage() {
    const navigate = useNavigate();

    const handleSubmit = async (data: ${ctx.entityName}CreateFormData) => {
        console.log("Create ${ctx.entityName}", data);
        navigate("${ctx.routePath}");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Create ${ctx.entityName}" description="Create a new ${_.startCase(ctx.entityVar)}." />
            <${ctx.entityName}Form
                mode="create"
                submitLabel="Create ${_.startCase(ctx.entityVar)}"
                onCancel={() => navigate("${ctx.routePath}")}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
`;
}

function renderEditPage(ctx) {
    return `import { useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/molecules/page-header";
import { ${ctx.entityName}Form } from "../components/${ctx.entityName}Form";
import type { ${ctx.entityName}UpdateFormData } from "../schemas/${ctx.entityKebab}UpdateSchema";

export function ${ctx.entityName}EditPage() {
    const navigate = useNavigate();
    const params = useParams();

    const handleSubmit = async (data: ${ctx.entityName}UpdateFormData) => {
        console.log("Update ${ctx.entityName}", params.id, data);
        navigate("${ctx.routePath}");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Edit ${ctx.entityName}" description="Update ${_.startCase(ctx.entityVar)} data." />
            <${ctx.entityName}Form
                mode="edit"
                submitLabel="Save changes"
                onCancel={() => navigate("${ctx.routePath}")}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
`;
}

function renderDetailPage(ctx) {
    return `import { useParams } from "react-router";

import { PageHeader } from "@/components/molecules/page-header";

export function ${ctx.entityName}DetailPage() {
    const params = useParams();

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="${ctx.entityName} Detail" description={\`Detail for ID: \${params.id}\`} />
        </div>
    );
}
`;
}

function renderRoutes(ctx) {
    return `import { ${ctx.entityName}ListPage } from "./pages/${ctx.entityName}ListPage";
import { ${ctx.entityName}CreatePage } from "./pages/${ctx.entityName}CreatePage";
import { ${ctx.entityName}DetailPage } from "./pages/${ctx.entityName}DetailPage";
import { ${ctx.entityName}EditPage } from "./pages/${ctx.entityName}EditPage";

export const ${ctx.entityVar}Routes = [
    { path: "${_.kebabCase(ctx.entityPlural)}", element: <${ctx.entityName}ListPage /> },
    { path: "${_.kebabCase(ctx.entityPlural)}/create", element: <${ctx.entityName}CreatePage /> },
    { path: "${_.kebabCase(ctx.entityPlural)}/:id", element: <${ctx.entityName}DetailPage /> },
    { path: "${_.kebabCase(ctx.entityPlural)}/:id/edit", element: <${ctx.entityName}EditPage /> },
];
`;
}

function renderFormFields(ctx) {
    const allFields = uniqueByName([...ctx.createFields, ...ctx.updateFields]);

    return allFields.map((field) => {
        const fieldName = requestFieldName(field);
        const label = labelForField(field);

        if (field.type === 'Boolean') {
            return `                        <FormCheckbox form={form} name="${fieldName}" label="${label}" />`;
        }

        if (field.type === 'Date') {
            return `                        <FormDatePicker form={form} name="${fieldName}" label="${label}" />`;
        }

        if (field.type === 'DateTime' || field.type === 'Instant') {
            return `                        <FormDateTimePicker form={form} name="${fieldName}" label="${label}" />`;
        }

        if (field.type === 'ManyToOne') {
            return `                        <FormLookupPicker form={form} name="${fieldName}" label="${label}" options={[]} />`;
        }

        if (field.type === 'Enum') {
            return `                        <FormSelect form={form} name="${fieldName}" label="${label}" options={[]} />`;
        }

        return `                        <FormInput form={form} name="${fieldName}" label="${label}"${inputTypeAttr(field)} />`;
    }).join('\n\n');
}

function collectFormImports(ctx) {
    const imports = new Set(['FormInput']);
    const fields = uniqueByName([...ctx.createFields, ...ctx.updateFields]);

    for (const field of fields) {
        if (field.type === 'Boolean') imports.add('FormCheckbox');
        if (field.type === 'Date') imports.add('FormDatePicker');
        if (field.type === 'DateTime' || field.type === 'Instant') imports.add('FormDateTimePicker');
        if (field.type === 'ManyToOne') imports.add('FormLookupPicker');
        if (field.type === 'Enum') imports.add('FormSelect');
    }

    return [...imports].sort();
}

function renderTsField(field) {
    return `    ${responseFieldName(field)}: ${tsType(field)};`;
}

function renderTsRequestField(field) {
    return `    ${requestFieldName(field)}: ${tsRequestType(field)};`;
}

function renderZodField(field) {
    if (field.type === 'Boolean') {
        return field.required ? 'z.boolean()' : 'z.boolean().optional()';
    }

    if (['Integer', 'Long', 'BigDecimal', 'Double'].includes(field.type)) {
        return field.required ? 'z.coerce.number()' : 'z.coerce.number().optional()';
    }

    let chain = 'z.string()';

    if (field.required) {
        chain += '.min(1, "This field is required")';
    } else {
        chain += '.optional()';
    }

    if (field.validation?.email) {
        chain = chain.replace('z.string()', 'z.string().email("Invalid email format")');
    }

    if (field.validation?.minLength !== undefined) {
        chain += `.min(${field.validation.minLength})`;
    }

    if (field.validation?.maxLength !== undefined) {
        chain += `.max(${field.validation.maxLength})`;
    } else if (field.length) {
        chain += `.max(${field.length})`;
    }

    return chain;
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
    return 'string';
}

function tsRequestType(field) {
    return tsType(field);
}

function labelForField(field) {
    return _.startCase(field.name);
}

function isDtoIncluded(field, dtoName) {
    return !field.dto || field.dto[dtoName] !== false;
}

function uniqueByName(fields) {
    return [...new Map(fields.map((field) => [requestFieldName(field), field])).values()];
}

function normalizeTs(content) {
    return content.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

module.exports = { generateWebResources };
