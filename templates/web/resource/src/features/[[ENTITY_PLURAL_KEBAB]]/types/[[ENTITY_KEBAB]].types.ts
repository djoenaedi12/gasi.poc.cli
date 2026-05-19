export type { ApiResponse, SearchRequest, PageResult } from "@/types/api.types";

export type {{ENTITY_NAME}}Summary = {
    id: string;
{{TYPES_SUMMARY_FIELDS}}
};

export type {{ENTITY_NAME}}Detail = {
    id: string;
{{TYPES_DETAIL_FIELDS}}
};

export type {{ENTITY_NAME}}CreateRequest = {
{{TYPES_CREATE_FIELDS}}
};

export type {{ENTITY_NAME}}UpdateRequest = {
{{TYPES_UPDATE_FIELDS}}
};
