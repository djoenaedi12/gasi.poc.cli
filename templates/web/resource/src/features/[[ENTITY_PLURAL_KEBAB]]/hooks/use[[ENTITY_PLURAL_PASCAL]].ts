import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { {{ENTITY_VAR}}Service } from "../services/{{ENTITY_KEBAB}}Service";
import type {
    SearchRequest,
    {{ENTITY_NAME}}CreateRequest,
    {{ENTITY_NAME}}UpdateRequest,
} from "../types/{{ENTITY_KEBAB}}.types";

export const {{ENTITY_VAR}}QueryKeys = {
    all: ["{{ENTITY_PLURAL}}"] as const,
    list: (request?: SearchRequest) => [...{{ENTITY_VAR}}QueryKeys.all, "list", request ?? {}] as const,
    detail: (id?: string) => [...{{ENTITY_VAR}}QueryKeys.all, "detail", id] as const,
};

export function use{{ENTITY_PLURAL_PASCAL}}(request?: SearchRequest) {
    return useQuery({
        queryKey: {{ENTITY_VAR}}QueryKeys.list(request),
        queryFn: () => {{ENTITY_VAR}}Service.list(request),
    });
}

export function use{{ENTITY_NAME}}(id?: string) {
    return useQuery({
        queryKey: {{ENTITY_VAR}}QueryKeys.detail(id),
        queryFn: () => {{ENTITY_VAR}}Service.detail(id as string),
        enabled: Boolean(id),
    });
}

export function useCreate{{ENTITY_NAME}}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: {{ENTITY_NAME}}CreateRequest) => {{ENTITY_VAR}}Service.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: {{ENTITY_VAR}}QueryKeys.all });
        },
    });
}

export function useUpdate{{ENTITY_NAME}}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: {{ENTITY_NAME}}UpdateRequest }) =>
            {{ENTITY_VAR}}Service.update(id, data),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: {{ENTITY_VAR}}QueryKeys.all });
            queryClient.invalidateQueries({ queryKey: {{ENTITY_VAR}}QueryKeys.detail(variables.id) });
        },
    });
}

export function useDelete{{ENTITY_NAME}}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => {{ENTITY_VAR}}Service.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: {{ENTITY_VAR}}QueryKeys.all });
        },
    });
}
