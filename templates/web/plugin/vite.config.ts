import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  resolve: {
    alias: {
      '@gasi/core-api': path.resolve(__dirname, '../../core-api/src'),
      '@gasi/core-ui':  path.resolve(__dirname, '../../core-ui/src'),
    },
  },
  build: {
    lib: {
      entry:    'src/index.ts',
      name:     '{{PLUGIN_GLOBAL_NAME}}',
      formats:  ['umd'],
      fileName: 'plugin-{{PLUGIN_NAME}}',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router', '@gasi/core-api', '@gasi/core-starter', '@gasi/core-ui'],
      output: {
        globals: {
          'react':               'React',
          'react-dom':           'ReactDOM',
          'react-router':        'ReactRouter',
          '@gasi/core-api':     'GasiCoreApi',
          '@gasi/core-starter': 'GasiCoreStarter',
          '@gasi/core-ui':      'GasiCoreUi',
        },
      },
    },
    outDir:      'dist',
    emptyOutDir: true,
  },
});
