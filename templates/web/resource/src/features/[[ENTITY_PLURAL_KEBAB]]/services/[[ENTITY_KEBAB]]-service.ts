import { createBaseService } from "@/lib/base-service";
import type {
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}UpdateRequest,
} from "../types/{{ENTITY_KEBAB}}.types";

export const {{ENTITY_VAR}}Service = createBaseService<
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}UpdateRequest
>("/api/v1/{{ENTITY_PLURAL_KEBAB}}");
