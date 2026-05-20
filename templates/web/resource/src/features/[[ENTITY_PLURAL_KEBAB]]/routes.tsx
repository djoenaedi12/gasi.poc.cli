import type { RouteDefinition } from '@gasi/core-api';
import { {{ENTITY_NAME}}ListPage }   from "./pages/{{ENTITY_KEBAB}}-list-page";
import { {{ENTITY_NAME}}CreatePage } from "./pages/{{ENTITY_KEBAB}}-create-page";
import { {{ENTITY_NAME}}DetailPage } from "./pages/{{ENTITY_KEBAB}}-detail-page";
import { {{ENTITY_NAME}}EditPage }   from "./pages/{{ENTITY_KEBAB}}-edit-page";

export const {{ENTITY_VAR}}Routes: RouteDefinition[] = [
    { path: "{{ROUTE_PATH}}",         component: {{ENTITY_NAME}}ListPage },
    { path: "{{ROUTE_PATH}}/create",  component: {{ENTITY_NAME}}CreatePage },
    { path: "{{ROUTE_PATH}}/:id",     component: {{ENTITY_NAME}}DetailPage },
    { path: "{{ROUTE_PATH}}/:id/edit", component: {{ENTITY_NAME}}EditPage },
];
