import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'i18n-vendor': ['i18next', 'react-i18next'],
          'icons-vendor': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
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
