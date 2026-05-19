import { z } from "zod";

export const {{ENTITY_VAR}}CreateSchema = z.object({
{{CREATE_SCHEMA_FIELDS}}
});

export type {{ENTITY_NAME}}CreateFormData = z.infer<typeof {{ENTITY_VAR}}CreateSchema>;
