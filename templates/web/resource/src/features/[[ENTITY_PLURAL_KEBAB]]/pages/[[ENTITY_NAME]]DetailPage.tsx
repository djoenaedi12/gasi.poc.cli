{{DETAIL_ICON_IMPORTS}}
import { {{DETAIL_ROUTER_IMPORTS}} } from "react-router";

{{DETAIL_CORE_API_IMPORTS}}
{{DETAIL_STORE_IMPORT}}
import { PageHeader } from "@gasi/core-ui";
{{DETAIL_BUTTON_IMPORT}}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gasi/core-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@gasi/core-ui";
import { use{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";

export function {{ENTITY_NAME}}DetailPage() {
{{DETAIL_NAVIGATE_SETUP}}
    const params = useParams();
{{DETAIL_PARENT_SETUP}}
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}({{DETAIL_QUERY_ARGS}});
{{DETAIL_PERMISSION_SETUP}}

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
    const breadcrumbLabel = {{BREADCRUMB_LABEL}};

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="{{ENTITY_NAME}} Detail"
                description={`Detail for ID: ${params.id}`}
                breadcrumbLabels={{ [params.id as string]: breadcrumbLabel }}
                {{DETAIL_ACTIONS}}
            />

            <Tabs defaultValue="general">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="max-w-3xl">
                    <Card>
                        <CardHeader>
                            <CardTitle>General</CardTitle>
                            <CardDescription>
                                Basic {{ENTITY_VAR_TITLE}} information used across the application.
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <dl className="grid gap-5">
{{DETAIL_FIELDS}}
                            </dl>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
