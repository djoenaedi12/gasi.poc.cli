import { {{CREATE_ROUTER_IMPORTS}} } from "react-router";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader, appToast, applyApiFieldErrors, getResourceCustom, useI18n } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form, type {{ENTITY_NAME}}FormData } from "../components/{{ENTITY_NAME}}Form";
import { useCreate{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}CreateFormData } from "../schemas/{{ENTITY_VAR}}CreateSchema";

type {{ENTITY_NAME}}CreateCustom = {
    create?: {
        headerActions?: (actions: ReactNode) => ReactNode;
        beforeSubmit?: (data: {{ENTITY_NAME}}CreateFormData) => {{ENTITY_NAME}}CreateFormData | Promise<{{ENTITY_NAME}}CreateFormData>;
        afterSubmit?: (result: unknown, data: {{ENTITY_NAME}}CreateFormData) => void | Promise<void>;
    };
};

export function {{ENTITY_NAME}}CreatePage() {
    const navigate = useNavigate();
    const { t } = useI18n();
    const custom = getResourceCustom<{{ENTITY_NAME}}CreateCustom>("{{ENTITY_VAR}}");
{{CREATE_PARENT_SETUP}}
    const create{{ENTITY_NAME}} = useCreate{{ENTITY_NAME}}({{CREATE_HOOK_ARGS}});
    const singularEntity = t("{{I18N_KEY_PREFIX}}.names.singular");
    const defaultHeaderActions = null;
    const headerActions = custom.create?.headerActions?.(defaultHeaderActions) ?? defaultHeaderActions;

{{CREATE_MISSING_PARENT_GUARD}}
    const handleSubmit = async (data: {{ENTITY_NAME}}CreateFormData, form: UseFormReturn<{{ENTITY_NAME}}FormData>) => {
        try {
            const payload = (await custom.create?.beforeSubmit?.(data)) ?? data;
            const result = await create{{ENTITY_NAME}}.mutateAsync(payload);
            await custom.create?.afterSubmit?.(result, payload);
            appToast.success(t("common.messages.createSuccess", { entity: singularEntity }));
            navigate({{NAVIGATE_AFTER_SAVE}});
        } catch (error) {
            if (applyApiFieldErrors(form, error)) {
                return;
            }
            appToast.error(error, t("common.messages.createError", { entity: singularEntity }));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("common.titles.createEntity", { entity: singularEntity })}
                description={t("common.descriptions.createEntity", { entity: singularEntity })}
                {{CREATE_BREADCRUMBS}}
                actions={headerActions}
            />
            <div className="w-full max-w-5xl">
                <{{ENTITY_NAME}}Form
                    mode="create"
                    submitLabel={create{{ENTITY_NAME}}.isPending ? t("common.actions.saving") : t("common.actions.save")}
                    onCancel={() => navigate({{NAVIGATE_AFTER_SAVE}})}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}
