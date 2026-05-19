import { {{ENTITY_NAME}}ListPage } from "./pages/{{ENTITY_KEBAB}}-list-page";
import { {{ENTITY_NAME}}CreatePage } from "./pages/{{ENTITY_KEBAB}}-create-page";
import { {{ENTITY_NAME}}DetailPage } from "./pages/{{ENTITY_KEBAB}}-detail-page";
import { {{ENTITY_NAME}}EditPage } from "./pages/{{ENTITY_KEBAB}}-edit-page";

export const {{ENTITY_VAR}}Routes = [
    { path: "{{ENTITY_PLURAL_KEBAB}}", element: <{{ENTITY_NAME}}ListPage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/create", element: <{{ENTITY_NAME}}CreatePage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/:id", element: <{{ENTITY_NAME}}DetailPage /> },
    { path: "{{ENTITY_PLURAL_KEBAB}}/:id/edit", element: <{{ENTITY_NAME}}EditPage /> },
];
