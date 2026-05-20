import { useNavigate } from "react-router";

import { PageHeader } from "@gasi/core-ui";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_KEBAB}}-form";
import { useCreate{{ENTITY_NAME}} } from "../hooks/use-{{ENTITY_KEBAB}}";
import type { {{ENTITY_NAME}}CreateFormData } from "../schemas/{{ENTITY_KEBAB}}-create-schema";

export function {{ENTITY_NAME}}CreatePage() {
    const navigate = useNavigate();
    const create{{ENTITY_NAME}} = useCreate{{ENTITY_NAME}}();

    const handleSubmit = async (data: {{ENTITY_NAME}}CreateFormData) => {
        await create{{ENTITY_NAME}}.mutateAsync(data);
        navigate("{{ROUTE_PATH}}");
    };

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Create {{ENTITY_NAME}}" description="Create a new {{ENTITY_VAR_TITLE}}." />
            <{{ENTITY_NAME}}Form
                mode="create"
                submitLabel={create{{ENTITY_NAME}}.isPending ? "Creating..." : "Create {{ENTITY_VAR_TITLE}}"}
                onCancel={() => navigate("{{ROUTE_PATH}}")}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
