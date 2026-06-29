import type { RouteDefinition } from '@gasi/core-api';

// Import halaman-halaman feature di sini
// import { {{PLUGIN_NAME_PASCAL}}ListPage } from './pages/{{PLUGIN_NAME_PASCAL}}ListPage';

/**
 * Daftarkan semua routes dari setiap feature di plugin ini.
 * Tambahkan spread routes dari sub-feature seiring berkembangnya plugin.
 *
 * Contoh:
 *   import { employeeRoutes }     from './employee/routes';
 *   import { organizationRoutes } from './organization/routes';
 *
 *   export const {{PLUGIN_NAME_CAMEL}}Routes: RouteDefinition[] = [
 *     ...employeeRoutes,
 *     ...organizationRoutes,
 *   ];
 */
export const {{PLUGIN_NAME_CAMEL}}Routes: RouteDefinition[] = [
  // routes akan ditambahkan oleh `gasi resource sync`
];
