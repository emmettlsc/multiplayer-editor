import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['monaco-editor', 'buffer', 'process', 'events', 'util'],
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      events: 'events',
      util: 'util',
    },
  },
});
