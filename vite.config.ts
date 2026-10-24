import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
// Vendor chunk groups; matched by package folder name (Rolldown needs a function, not an object).
const VENDOR_CHUNKS: Record<string, string[]> = {
  'react-vendor': ['react', 'react-dom'],
  'i18n-vendor': ['i18next', 'react-i18next'],
  'icons-vendor': ['lucide-react'],
  'graph-vendor': ['cytoscape', 'cytoscape-fcose', 'cytoscape-dagre'],
  'tauri-vendor': [
    '@tauri-apps/api',
    '@tauri-apps/plugin-dialog',
    '@tauri-apps/plugin-notification',
    '@tauri-apps/plugin-process',
    '@tauri-apps/plugin-updater',
  ],
  'data-vendor': ['zod', 'zustand', 'date-fns', 'tldts', 'clsx'],
};

export default defineConfig({
  // Tauri serves the production bundle through tauri://localhost. Relative
  // asset URLs are required there; absolute /assets paths resolve outside the
  // bundled frontend and leave the WebView with an empty document.
  base: './',
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Prevent vite from obscuring rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Tell vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          const path = id.replace(/\\/g, '/');
          if (!path.includes('/node_modules/')) return undefined;
          return Object.entries(VENDOR_CHUNKS).find(([, packages]) => packages.some((name) => path.includes(`/node_modules/${name}/`)))?.[0];
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  test: {
    // Worktrees may contain older copies of the suite. Only this checkout's
    // canonical tests may import this checkout's production modules.
    include: ['tests/**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs,mts,cts}'],
    // Coverage plus large DOM fixtures can saturate shared desktop/CI hosts.
    // Bound parallelism while keeping every test and its existing timeout.
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'mcp-server/src/contracts/**/*.ts'],
      // These files contain declarations only (no executable exports).
      exclude: ['src/types/**'],
      reporter: ['text-summary', 'json-summary', 'json', 'lcov'],
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    exclude: ['mcp-server/**', 'node_modules/**', 'dist/**', 'src-tauri/target/**'],
  },
});
