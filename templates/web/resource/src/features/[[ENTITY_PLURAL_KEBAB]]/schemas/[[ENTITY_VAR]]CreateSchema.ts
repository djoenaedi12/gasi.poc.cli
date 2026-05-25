import { z } from "zod";

import { translate, type Translate } from "@gasi/core-ui";

export function create{{ENTITY_NAME}}CreateSchema(t: Translate = translate) {
    return z.object({
{{CREATE_SCHEMA_FIELDS}}
    });
}

export const {{ENTITY_VAR}}CreateSchema = create{{ENTITY_NAME}}CreateSchema();

export type {{ENTITY_NAME}}CreateFormData = z.infer<typeof {{ENTITY_VAR}}CreateSchema>;
