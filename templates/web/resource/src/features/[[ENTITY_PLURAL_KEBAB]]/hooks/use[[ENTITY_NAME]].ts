import { createBaseHooks } from "@gasi/core-ui";
{{HOOK_API_IMPORT}}import { {{HOOK_SERVICE_IMPORT}} } from "../services/{{ENTITY_VAR}}Service";
import type {
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}UpdateRequest,
} from "../types/{{ENTITY_VAR}}.types";

{{HOOK_EXPORTS}}
