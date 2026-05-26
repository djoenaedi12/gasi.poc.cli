{{DETAIL_ICON_IMPORTS}}
import { {{DETAIL_ROUTER_IMPORTS}} } from "react-router";

{{DETAIL_CORE_API_IMPORTS}}
{{DETAIL_STORE_IMPORT}}
import { PageHeader } from "@gasi/core-ui";
{{DETAIL_BUTTON_IMPORT}}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gasi/core-ui";
import { CardTabs, CardTabsContent, CardTabsList, CardTabsTrigger, useI18n } from "@gasi/core-ui";
import { use{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";

export function {{ENTITY_NAME}}DetailPage() {
{{DETAIL_NAVIGATE_SETUP}}
    const params = useParams();
    const { t } = useI18n();
{{DETAIL_PARENT_SETUP}}
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}({{DETAIL_QUERY_ARGS}});
{{DETAIL_PERMISSION_SETUP}}
    const singularEntity = t("{{I18N_KEY_PREFIX}}.names.singular");

    if (!params.id) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    if ({{ENTITY_VAR}}Query.isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader
                    title={t("common.titles.detailEntity", { entity: singularEntity })}
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
                title={t("common.titles.detailEntity", { entity: singularEntity })}
                description={t("common.descriptions.detailById", { id: params.id })}
                breadcrumbLabels={{ [params.id as string]: breadcrumbLabel }}
                {{DETAIL_BREADCRUMBS}}
                {{DETAIL_ACTIONS}}
            />

            <CardTabs defaultValue="general" className="w-full max-w-3xl">
                <CardTabsList>
                    <CardTabsTrigger value="general">{t("common.tabs.general")}</CardTabsTrigger>
                </CardTabsList>

                <CardTabsContent value="general">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("common.tabs.general")}</CardTitle>
                            <CardDescription>
                                {t("common.descriptions.generalEntityInfo", { entity: singularEntity })}
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <dl className="grid gap-5">
{{DETAIL_FIELDS}}
                            </dl>
                        </CardContent>
                    </Card>
                </CardTabsContent>
            </CardTabs>
        </div>
    );
}
