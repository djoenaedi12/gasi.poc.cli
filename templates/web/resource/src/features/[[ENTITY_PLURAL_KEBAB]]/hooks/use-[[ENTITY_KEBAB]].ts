import { createBaseHooks } from "@/lib/base-hooks";
import { {{ENTITY_VAR}}Service } from "../services/{{ENTITY_KEBAB}}-service";
import type {
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}UpdateRequest,
} from "../types/{{ENTITY_KEBAB}}.types";

const hooks = createBaseHooks<
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}UpdateRequest
>("{{ENTITY_PLURAL_KEBAB}}", {{ENTITY_VAR}}Service);

export const {{ENTITY_VAR}}QueryKeys = hooks.queryKeys;
export const use{{ENTITY_PLURAL_PASCAL}} = hooks.useList;
export const use{{ENTITY_PLURAL_PASCAL}}Page = hooks.usePage;
export const use{{ENTITY_NAME}} = hooks.useDetail;
export const useCreate{{ENTITY_NAME}} = hooks.useCreate;
export const useUpdate{{ENTITY_NAME}} = hooks.useUpdate;
export const useDelete{{ENTITY_NAME}} = hooks.useDelete;
