import { Navigate, useNavigate, useParams } from "react-router";

import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_NAME}}Form";
import { use{{ENTITY_NAME}}, useUpdate{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}UpdateFormData } from "../schemas/{{ENTITY_VAR}}UpdateSchema";

export function {{ENTITY_NAME}}EditPage() {
    const navigate = useNavigate();
    const params = useParams();
{{EDIT_PARENT_SETUP}}
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}({{DETAIL_QUERY_ARGS}});
    const update{{ENTITY_NAME}} = useUpdate{{ENTITY_NAME}}({{UPDATE_HOOK_ARGS}});

    if (!params.id) {
        return <Navigate to={ {{NAVIGATE_LIST}} } replace />;
    }

    const handleSubmit = async (data: {{ENTITY_NAME}}UpdateFormData) => {
        await update{{ENTITY_NAME}}.mutateAsync({ id: params.id as string, data });
        navigate({{NAVIGATE_LIST}});
    };

    if ({{ENTITY_VAR}}Query.isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Edit {{ENTITY_NAME}}" description="Loading {{ENTITY_VAR_TITLE}} data." />
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
                title="Edit {{ENTITY_NAME}}"
                description="Update {{ENTITY_VAR_TITLE}} data."
                breadcrumbLabels={{ [params.id as string]: breadcrumbLabel }}
            />
            <Tabs defaultValue="general">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="max-w-3xl">
                    <{{ENTITY_NAME}}Form
                        mode="edit"
                        defaultValues={{{ENTITY_VAR}}}
                        submitLabel={update{{ENTITY_NAME}}.isPending ? "Saving..." : "Save"}
                        onCancel={() => navigate({{NAVIGATE_LIST}})}
                        onSubmit={handleSubmit}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
