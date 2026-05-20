import { {{CREATE_ROUTER_IMPORTS}} } from "react-router";

import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_KEBAB}}-form";
import { useCreate{{ENTITY_NAME}} } from "../hooks/use-{{ENTITY_KEBAB}}";
import type { {{ENTITY_NAME}}CreateFormData } from "../schemas/{{ENTITY_KEBAB}}-create-schema";

export function {{ENTITY_NAME}}CreatePage() {
    const navigate = useNavigate();
{{CREATE_PARENT_SETUP}}
    const create{{ENTITY_NAME}} = useCreate{{ENTITY_NAME}}({{CREATE_HOOK_ARGS}});

{{CREATE_MISSING_PARENT_GUARD}}
    const handleSubmit = async (data: {{ENTITY_NAME}}CreateFormData) => {
        await create{{ENTITY_NAME}}.mutateAsync(data);
        navigate({{NAVIGATE_LIST}});
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Create {{ENTITY_NAME}}" description="Create a new {{ENTITY_VAR_TITLE}}." />
            <Tabs defaultValue="general">
                <TabsList variant="line">
                    <TabsTrigger value="general">General</TabsTrigger>
                </TabsList>
                <TabsContent value="general">
                    <{{ENTITY_NAME}}Form
                        mode="create"
                        submitLabel={create{{ENTITY_NAME}}.isPending ? "Creating..." : "Create {{ENTITY_VAR_TITLE}}"}
                        onCancel={() => navigate({{NAVIGATE_LIST}})}
                        onSubmit={handleSubmit}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
