import { Navigate, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/molecules/page-header";
import { {{ENTITY_NAME}}Form } from "../components/{{ENTITY_NAME}}Form";
import { use{{ENTITY_NAME}}, useUpdate{{ENTITY_NAME}} } from "../hooks/use{{ENTITY_PLURAL_PASCAL}}";
import type { {{ENTITY_NAME}}UpdateFormData } from "../schemas/{{ENTITY_KEBAB}}UpdateSchema";

export function {{ENTITY_NAME}}EditPage() {
    const navigate = useNavigate();
    const params = useParams();
    const {{ENTITY_VAR}}Query = use{{ENTITY_NAME}}(params.id);
    const update{{ENTITY_NAME}} = useUpdate{{ENTITY_NAME}}();

    if (!params.id) {
        return <Navigate to="{{ROUTE_PATH}}" replace />;
    }

    const handleSubmit = async (data: {{ENTITY_NAME}}UpdateFormData) => {
        await update{{ENTITY_NAME}}.mutateAsync({ id: params.id as string, data });
        navigate("{{ROUTE_PATH}}");
    };

    if ({{ENTITY_VAR}}Query.isLoading) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Edit {{ENTITY_NAME}}" description="Loading {{ENTITY_VAR_TITLE}} data." />
            </div>
        );
    }

    if ({{ENTITY_VAR}}Query.isError || !{{ENTITY_VAR}}Query.data) {
        return <Navigate to="{{ROUTE_PATH}}" replace />;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Edit {{ENTITY_NAME}}" description="Update {{ENTITY_VAR_TITLE}} data." />
            <{{ENTITY_NAME}}Form
                mode="edit"
                defaultValues={{{ENTITY_VAR}}Query.data}
                submitLabel={update{{ENTITY_NAME}}.isPending ? "Saving..." : "Save changes"}
                onCancel={() => navigate("{{ROUTE_PATH}}")}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
