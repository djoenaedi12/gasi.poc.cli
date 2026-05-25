import type { RouteDefinition } from '@gasi/core-api';
import { createResourceRoutes, translate } from '@gasi/core-ui';
import "./i18n";
{{ROUTE_IMPORTS}}

export const {{ENTITY_VAR}}Routes: RouteDefinition[] = [
{{ROUTE_DEFINITIONS}}
];
