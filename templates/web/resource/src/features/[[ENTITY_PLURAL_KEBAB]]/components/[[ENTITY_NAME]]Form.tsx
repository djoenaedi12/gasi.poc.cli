import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

{{FORM_IMPORTS}}
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    {{ENTITY_VAR}}CreateSchema,
    type {{ENTITY_NAME}}CreateFormData,
} from "../schemas/{{ENTITY_KEBAB}}CreateSchema";
import {
    {{ENTITY_VAR}}UpdateSchema,
    type {{ENTITY_NAME}}UpdateFormData,
} from "../schemas/{{ENTITY_KEBAB}}UpdateSchema";

type {{ENTITY_NAME}}FormProps =
    | {
        mode: "create";
        defaultValues?: Partial<{{ENTITY_NAME}}CreateFormData>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: {{ENTITY_NAME}}CreateFormData) => void | Promise<void>;
    }
    | {
        mode: "edit";
        defaultValues?: Partial<{{ENTITY_NAME}}UpdateFormData>;
        submitLabel: string;
        onCancel: () => void;
        onSubmit: (data: {{ENTITY_NAME}}UpdateFormData) => void | Promise<void>;
    };

type {{ENTITY_NAME}}FormData = {{ENTITY_NAME}}CreateFormData | {{ENTITY_NAME}}UpdateFormData;

export function {{ENTITY_NAME}}Form(props: {{ENTITY_NAME}}FormProps) {
    const form = useForm<{{ENTITY_NAME}}FormData>({
        resolver: zodResolver(props.mode === "create" ? {{ENTITY_VAR}}CreateSchema : {{ENTITY_VAR}}UpdateSchema) as never,
        defaultValues: props.defaultValues as Partial<{{ENTITY_NAME}}FormData>,
    });

    return (
        <Card>
            <CardContent>
                <form onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
{{FORM_FIELDS}}
                    </div>

                    <div className="flex justify-end gap-2 border-t pt-5">
                        <Button type="button" variant="outline" onClick={props.onCancel}>
                            Cancel
                        </Button>
                        <FormButton loading={form.formState.isSubmitting}>
                            {props.submitLabel}
                        </FormButton>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
