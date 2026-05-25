import { z } from "zod";

import { translate, type Translate } from "@gasi/core-ui";

export function create{{ENTITY_NAME}}UpdateSchema(t: Translate = translate) {
    return z.object({
{{UPDATE_SCHEMA_FIELDS}}
    });
}

export const {{ENTITY_VAR}}UpdateSchema = create{{ENTITY_NAME}}UpdateSchema();

export type {{ENTITY_NAME}}UpdateFormData = z.infer<typeof {{ENTITY_VAR}}UpdateSchema>;
