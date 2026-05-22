import { z } from "zod";

export const {{ENTITY_VAR}}UpdateSchema = z.object({
{{UPDATE_SCHEMA_FIELDS}}
});

export type {{ENTITY_NAME}}UpdateFormData = z.infer<typeof {{ENTITY_VAR}}UpdateSchema>;
