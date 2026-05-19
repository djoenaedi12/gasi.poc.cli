export type ApiResponse<T> = {
    success: boolean;
    message: string;
    data: T;
    errors?: string[];
    timestamp?: string;
};

export type SearchRequest = {
    filter?: unknown;
    sorts?: unknown[];
    page?: number;
    size?: number;
};

export type PageResult<T> = {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
};

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
