import { Navigate, useParams } from "react-router";

import { PageHeader } from "@gasi/core-ui";
import { Card, CardContent } from "@gasi/core-ui";
import { use{{ENTITY_NAME}} } from "../hooks/use-{{ENTITY_KEBAB}}";

export function {{ENTITY_NAME}}DetailPage() {
    const params = useParams();
{{DETAIL_PARENT_SETUP}}
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}({{DETAIL_QUERY_ARGS}});

    if (!params.id) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    if ({{ENTITY_VAR}}Query.isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="{{ENTITY_NAME}} Detail" description="Loading {{ENTITY_VAR_TITLE}} data." />
            </div>
        );
    }

    if ({{ENTITY_VAR}}Query.isError || !{{ENTITY_VAR}}Query.data) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    const {{ENTITY_VAR}} = {{ENTITY_VAR}}Query.data;

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="{{ENTITY_NAME}} Detail" description={`Detail for ID: ${params.id}`} />

            <Card>
                <CardContent>
                    <dl className="grid gap-5 md:grid-cols-2">
{{DETAIL_FIELDS}}
                    </dl>
                </CardContent>
            </Card>
        </div>
    );
}
