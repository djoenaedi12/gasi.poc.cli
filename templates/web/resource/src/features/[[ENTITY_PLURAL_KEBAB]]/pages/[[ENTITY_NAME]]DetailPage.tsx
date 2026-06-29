{{DETAIL_ICON_IMPORTS}}
import { {{DETAIL_ROUTER_IMPORTS}} } from "react-router";
import type { ReactNode } from "react";

{{DETAIL_CORE_API_IMPORTS}}
{{DETAIL_STORE_IMPORT}}
import { PageHeader, getResourceCustom } from "@gasi/core-ui";
{{DETAIL_BUTTON_IMPORT}}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gasi/core-ui";
import { CardTabs, CardTabsContent, CardTabsList, CardTabsTrigger, useI18n } from "@gasi/core-ui";
import { use{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}Detail } from "../types/{{ENTITY_VAR}}.types";

type {{ENTITY_NAME}}DetailCustom = {
    detail?: {
        headerActions?: (
            actions: ReactNode,
            context: {
                data: {{ENTITY_NAME}}Detail;
                id: string;
            },
        ) => ReactNode;
    };
};

export function {{ENTITY_NAME}}DetailPage() {
{{DETAIL_NAVIGATE_SETUP}}
    const params = useParams();
    const { t } = useI18n();
    const custom = getResourceCustom<{{ENTITY_NAME}}DetailCustom>("{{ENTITY_VAR}}");
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
{{DETAIL_ACTIONS_SETUP}}

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("common.titles.detailEntity", { entity: singularEntity })}
                description={t("common.descriptions.detailById", { id: params.id })}
                breadcrumbLabels={{ [params.id as string]: breadcrumbLabel }}
                {{DETAIL_BREADCRUMBS}}
                actions={headerActions}
            />

{{DETAIL_FIELDS}}
        </div>
    );
}
