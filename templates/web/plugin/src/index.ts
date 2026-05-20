import { pluginRegistry, ExtensionPoints } from '@gasi/core-api';
import { {{PLUGIN_NAME_CAMEL}}Routes } from './features/{{PLUGIN_NAME}}/routes';

pluginRegistry.register({
  id:          'plugin.{{PLUGIN_NAME}}',
  name:        '{{PLUGIN_TITLE}} Module',
  version:     '{{PLUGIN_VERSION}}',
  description: '{{PLUGIN_DESCRIPTION}}',
  extensions: [
    {
      point:  ExtensionPoints.ROUTE,
      routes: {{PLUGIN_NAME_CAMEL}}Routes,
    },
  ],
  onStart() { console.info('[plugin.{{PLUGIN_NAME}}] started'); },
  onStop()  { console.info('[plugin.{{PLUGIN_NAME}}] stopped'); },
});
