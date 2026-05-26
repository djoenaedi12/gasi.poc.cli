import type { RouteDefinition } from '@gasi/core-api';
import { {{ROUTE_CORE_UI_IMPORTS}} } from '@gasi/core-ui';
import "./i18n";
{{ROUTE_IMPORTS}}

export const {{ENTITY_VAR}}Routes: RouteDefinition[] = [
{{ROUTE_DEFINITIONS}}
];
