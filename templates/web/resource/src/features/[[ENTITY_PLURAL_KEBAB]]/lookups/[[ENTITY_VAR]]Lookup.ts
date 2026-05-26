import type { LookupPreset } from "@gasi/core-ui";

import { use{{ENTITY_PLURAL_PASCAL}}LookupPage } from "../hooks/use{{ENTITY_NAME}}";
import type { {{ENTITY_NAME}}Summary } from "../types/{{ENTITY_VAR}}.types";

export const {{ENTITY_VAR}}Lookup: LookupPreset<{{ENTITY_NAME}}Summary> = {
    pageQuery: use{{ENTITY_PLURAL_PASCAL}}LookupPage,
    mapOption: (item) => {
        const record = item as Record<string, unknown>;
        const label = {{LOOKUP_LABEL_FIELDS}}.map((field) => record[field])
            .filter(Boolean)
            .join(" - ") || String(record.id);
        const description = {{LOOKUP_DESCRIPTION_FIELDS}}.map((field) => record[field])
            .filter(Boolean)
            .join(" - ");

        return {
            value: String(record.id),
            label,
            description: description || undefined,
            meta: Object.fromEntries({{LOOKUP_META_FIELDS}}.map((field) => [field, record[field]])),
        };
    },
    displayColumns: {{LOOKUP_DISPLAY_COLUMNS}},
    searchFields: {{LOOKUP_SEARCH_FIELDS}},
};
