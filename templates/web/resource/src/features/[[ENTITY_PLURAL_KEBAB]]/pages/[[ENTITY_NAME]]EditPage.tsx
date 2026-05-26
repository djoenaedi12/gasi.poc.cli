import { Navigate, useNavigate, useParams } from "react-router";

import { CardTabs, CardTabsContent, CardTabsList, CardTabsTrigger, PageHeader, appToast, useI18n } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_NAME}}Form";
import { use{{ENTITY_NAME}}, useUpdate{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}UpdateFormData } from "../schemas/{{ENTITY_VAR}}UpdateSchema";

export function {{ENTITY_NAME}}EditPage() {
    const navigate = useNavigate();
    const params = useParams();
    const { t } = useI18n();
{{EDIT_PARENT_SETUP}}
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}({{DETAIL_QUERY_ARGS}});
    const update{{ENTITY_NAME}} = useUpdate{{ENTITY_NAME}}({{UPDATE_HOOK_ARGS}});
    const singularEntity = t("{{I18N_KEY_PREFIX}}.names.singular");

    if (!params.id) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    const handleSubmit = async (data: {{ENTITY_NAME}}UpdateFormData) => {
        try {
            await update{{ENTITY_NAME}}.mutateAsync({ id: params.id as string, data });
            appToast.success(t("common.messages.updateSuccess", { entity: singularEntity }));
            navigate({{NAVIGATE_AFTER_SAVE}});
        } catch (error) {
            appToast.error(error, t("common.messages.updateError", { entity: singularEntity }));
        }
    };

    if ({{ENTITY_VAR}}Query.isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title={t("common.titles.editEntity", { entity: singularEntity })}
                    description={t("common.descriptions.loadingEntityData", { entity: singularEntity })}
                />
            </div>
        );
    }

    if ({{ENTITY_VAR}}Query.isError || !{{ENTITY_VAR}}Query.data) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    const {{ENTITY_VAR}} = {{ENTITY_VAR}}Query.data;
    const breadcrumbLabel = {{BREADCRUMB_LABEL}};

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("common.titles.editEntity", { entity: singularEntity })}
                description={t("common.descriptions.updateEntity", { entity: singularEntity })}
                breadcrumbLabels={{ [params.id as string]: breadcrumbLabel }}
                {{EDIT_BREADCRUMBS}}
            />
            <CardTabs defaultValue="general" className="w-full max-w-3xl">
                <CardTabsList>
                    <CardTabsTrigger value="general">{t("common.tabs.general")}</CardTabsTrigger>
                </CardTabsList>

                <CardTabsContent value="general">
                    <{{ENTITY_NAME}}Form
                        mode="edit"
                        defaultValues={{{ENTITY_VAR}}}
                        submitLabel={update{{ENTITY_NAME}}.isPending ? t("common.actions.saving") : t("common.actions.save")}
                        onCancel={() => navigate({{NAVIGATE_AFTER_SAVE}})}
                        onSubmit={handleSubmit}
                    />
                </CardTabsContent>
            </CardTabs>
        </div>
    );
}
