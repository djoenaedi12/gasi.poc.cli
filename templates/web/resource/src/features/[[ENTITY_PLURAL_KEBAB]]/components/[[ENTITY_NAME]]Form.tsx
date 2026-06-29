import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";

{{FORM_IMPORTS}}
import { Button, getResourceCustom, useI18n } from "@gasi/core-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gasi/core-ui";
import {
    create{{ENTITY_NAME}}CreateSchema,
    type {{ENTITY_NAME}}CreateFormData,
} from "../schemas/{{ENTITY_VAR}}CreateSchema";
import {
    create{{ENTITY_NAME}}UpdateSchema,
    type {{ENTITY_NAME}}UpdateFormData,
} from "../schemas/{{ENTITY_VAR}}UpdateSchema";
{{FORM_LOOKUP_IMPORTS}}

type {{ENTITY_NAME}}FormProps =
    | {
        mode: "create";
        defaultValues?: Partial<{{ENTITY_NAME}}CreateFormData>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: {{ENTITY_NAME}}CreateFormData, form: UseFormReturn<{{ENTITY_NAME}}FormData>) => void | Promise<void>;
    }
    | {
        mode: "edit";
        defaultValues?: Partial<{{ENTITY_NAME}}UpdateFormData>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: {{ENTITY_NAME}}UpdateFormData, form: UseFormReturn<{{ENTITY_NAME}}FormData>) => void | Promise<void>;
    };

export type {{ENTITY_NAME}}FormData = {{ENTITY_NAME}}CreateFormData | {{ENTITY_NAME}}UpdateFormData;

type {{ENTITY_NAME}}FormCustom = {
    form?: {
        footerActions?: (
            actions: ReactNode,
            context: {
                mode: {{ENTITY_NAME}}FormProps["mode"];
                form: UseFormReturn<{{ENTITY_NAME}}FormData>;
                isSubmitting: boolean;
                onCancel: () => void;
                submitLabel: string;
            },
        ) => ReactNode;
    };
};

export function {{ENTITY_NAME}}Form(props: {{ENTITY_NAME}}FormProps) {
    const { t } = useI18n();
    const custom = getResourceCustom<{{ENTITY_NAME}}FormCustom>("{{ENTITY_VAR}}");
    const schema = useMemo(
        () => props.mode === "create" ? create{{ENTITY_NAME}}CreateSchema(t) : create{{ENTITY_NAME}}UpdateSchema(t),
        [props.mode, t],
    );

    const form = useForm<{{ENTITY_NAME}}FormData>({
        resolver: zodResolver(schema) as never,
        defaultValues: props.defaultValues as Partial<{{ENTITY_NAME}}FormData>,
    });

    const defaultFooterActions = (
        <>
            <Button type="button" variant="outline" onClick={props.onCancel}>
                {t("common.actions.cancel")}
            </Button>
            <FormButton loading={form.formState.isSubmitting}>
                <Save className="size-4" />
                {props.submitLabel}
            </FormButton>
        </>
    );
    const footerActions = custom.form?.footerActions?.(defaultFooterActions, {
        mode: props.mode,
        form,
        isSubmitting: form.formState.isSubmitting,
        onCancel: props.onCancel,
        submitLabel: props.submitLabel,
    }) ?? defaultFooterActions;

    return (
        <form onSubmit={form.handleSubmit((data) => props.onSubmit(data as never, form))} className="space-y-6">
{{FORM_FIELDS}}

            <div className="flex justify-end gap-2 border-t pt-5">
                {footerActions}
            </div>
        </form>
    );
}
