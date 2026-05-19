import { api } from "@/lib/axios";
import type {
    ApiResponse,
    SearchRequest,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}Detail,
    {{ENTITY_NAME}}Summary,
    {{ENTITY_NAME}}UpdateRequest,
} from "../types/{{ENTITY_KEBAB}}.types";

const basePath = "{{ROUTE_PATH}}";

export const {{ENTITY_VAR}}Service = {
    list: (request: SearchRequest = {}) =>
        api
            .post<ApiResponse<{{ENTITY_NAME}}Summary[]>>(`${basePath}/search/list`, request)
            .then((response) => response.data.data ?? []),

    detail: (id: string) =>
        api
            .get<ApiResponse<{{ENTITY_NAME}}Detail>>(`${basePath}/${id}`)
            .then((response) => response.data.data),

    create: (data: {{ENTITY_NAME}}CreateRequest) =>
        api
            .post<ApiResponse<{{ENTITY_NAME}}Detail>>(basePath, data)
            .then((response) => response.data.data),

    update: (id: string, data: {{ENTITY_NAME}}UpdateRequest) =>
        api
            .put<ApiResponse<{{ENTITY_NAME}}Detail>>(`${basePath}/${id}`, data)
            .then((response) => response.data.data),

    delete: (id: string) =>
        api.delete<ApiResponse<void>>(`${basePath}/${id}`).then((response) => response.data.data),
};
