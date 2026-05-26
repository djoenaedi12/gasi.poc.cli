import { {{CREATE_ROUTER_IMPORTS}} } from "react-router";

import { CardTabs, CardTabsContent, CardTabsList, CardTabsTrigger, PageHeader, appToast, useI18n } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_NAME}}Form";
import { useCreate{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}CreateFormData } from "../schemas/{{ENTITY_VAR}}CreateSchema";

export function {{ENTITY_NAME}}CreatePage() {
    const navigate = useNavigate();
    const { t } = useI18n();
{{CREATE_PARENT_SETUP}}
    const create{{ENTITY_NAME}} = useCreate{{ENTITY_NAME}}({{CREATE_HOOK_ARGS}});
    const singularEntity = t("{{I18N_KEY_PREFIX}}.names.singular");

{{CREATE_MISSING_PARENT_GUARD}}
    const handleSubmit = async (data: {{ENTITY_NAME}}CreateFormData) => {
        try {
            await create{{ENTITY_NAME}}.mutateAsync(data);
            appToast.success(t("common.messages.createSuccess", { entity: singularEntity }));
            navigate({{NAVIGATE_AFTER_SAVE}});
        } catch (error) {
            appToast.error(error, t("common.messages.createError", { entity: singularEntity }));
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("common.titles.createEntity", { entity: singularEntity })}
                description={t("common.descriptions.createEntity", { entity: singularEntity })}
                {{CREATE_BREADCRUMBS}}
            />
            <CardTabs defaultValue="general" className="w-full max-w-3xl">
                <CardTabsList>
                    <CardTabsTrigger value="general">{t("common.tabs.general")}</CardTabsTrigger>
                </CardTabsList>

                <CardTabsContent value="general">
                    <{{ENTITY_NAME}}Form
                        mode="create"
                        submitLabel={create{{ENTITY_NAME}}.isPending ? t("common.actions.saving") : t("common.actions.save")}
                        onCancel={() => navigate({{NAVIGATE_AFTER_SAVE}})}
                        onSubmit={handleSubmit}
                    />
                </CardTabsContent>
            </CardTabs>
        </div>
    );
}
