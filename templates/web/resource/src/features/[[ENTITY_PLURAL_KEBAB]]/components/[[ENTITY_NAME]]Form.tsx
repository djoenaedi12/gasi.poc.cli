import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

{{FORM_IMPORTS}}
import { Button, useI18n } from "@gasi/core-ui";
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
        onSubmit: (data: {{ENTITY_NAME}}CreateFormData) => void | Promise<void>;
    }
    | {
        mode: "edit";
        defaultValues?: Partial<{{ENTITY_NAME}}UpdateFormData>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: {{ENTITY_NAME}}UpdateFormData) => void | Promise<void>;
    };

type {{ENTITY_NAME}}FormData = {{ENTITY_NAME}}CreateFormData | {{ENTITY_NAME}}UpdateFormData;

export function {{ENTITY_NAME}}Form(props: {{ENTITY_NAME}}FormProps) {
    const { t } = useI18n();
    const schema = useMemo(
        () => props.mode === "create" ? create{{ENTITY_NAME}}CreateSchema(t) : create{{ENTITY_NAME}}UpdateSchema(t),
        [props.mode, t],
    );

    const form = useForm<{{ENTITY_NAME}}FormData>({
        resolver: zodResolver(schema) as never,
        defaultValues: props.defaultValues as Partial<{{ENTITY_NAME}}FormData>,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("common.tabs.general")}</CardTitle>
                <CardDescription>
                    {t("common.descriptions.generalEntityInfo", { entity: t("{{I18N_KEY_PREFIX}}.names.singular") })}
                </CardDescription>
            </CardHeader>

            <CardContent>
                <form onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-6">
                    <div className="grid gap-5">
{{FORM_FIELDS}}
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-5">
                        <Button type="button" variant="outline" onClick={props.onCancel}>
                            {t("common.actions.cancel")}
                        </Button>
                        <FormButton loading={form.formState.isSubmitting}>
                            <Save className="size-4" />
                            {props.submitLabel}
                        </FormButton>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
