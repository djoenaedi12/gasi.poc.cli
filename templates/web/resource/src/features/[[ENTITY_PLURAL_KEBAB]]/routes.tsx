import { {{ENTITY_NAME}}ListPage } from "./pages/{{ENTITY_NAME}}ListPage";
import { {{ENTITY_NAME}}CreatePage } from "./pages/{{ENTITY_NAME}}CreatePage";
import { {{ENTITY_NAME}}DetailPage } from "./pages/{{ENTITY_NAME}}DetailPage";
import { {{ENTITY_NAME}}EditPage } from "./pages/{{ENTITY_NAME}}EditPage";

export const {{ENTITY_VAR}}Routes = [
    { path: "{{ENTITY_PLURAL_KEBAB}}", element: <{{ENTITY_NAME}}ListPage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/create", element: <{{ENTITY_NAME}}CreatePage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/:id", element: <{{ENTITY_NAME}}DetailPage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/:id/edit", element: <{{ENTITY_NAME}}EditPage /> },
];
