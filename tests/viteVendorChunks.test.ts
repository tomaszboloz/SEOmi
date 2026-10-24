import { describe, expect, it } from 'vitest';

import config from '../vite.config';

type ChunkFn = (id: string) => string | undefined;
const output = config.build?.rollupOptions?.output;
const manualChunks = (Array.isArray(output) ? output[0] : output)?.manualChunks as ChunkFn;
const root = '/repo/node_modules';

describe('vite vendor chunks (Rolldown requires a function)', () => {
  it('is a function, not an object', () => {
    expect(typeof manualChunks).toBe('function');
  });

  it.each([
    [`${root}/react/index.js`, 'react-vendor'],
    [`${root}/react-dom/client.js`, 'react-vendor'],
    [`${root}/i18next/dist/esm/i18next.js`, 'i18n-vendor'],
    [`${root}/react-i18next/dist/es/index.js`, 'i18n-vendor'],
    [`${root}/lucide-react/dist/esm/icons/a.js`, 'icons-vendor'],
    [`${root}/cytoscape-fcose/index.js`, 'graph-vendor'],
    [`${root}/@tauri-apps/api/core.js`, 'tauri-vendor'],
    [`${root}/@tauri-apps/plugin-dialog/dist/index.js`, 'tauri-vendor'],
    [`${root}/zod/v4/index.js`, 'data-vendor'],
    [`${root}/zustand/esm/index.mjs`, 'data-vendor'],
  ])('puts %s into %s', (id, chunk) => {
    expect(manualChunks(id)).toBe(chunk);
  });

  it('does not match look-alike package names or application sources', () => {
    expect(manualChunks(`${root}/react-select/index.js`)).toBeUndefined();
    expect(manualChunks(`${root}/zod-to-json-schema/index.js`)).toBeUndefined();
    expect(manualChunks('/repo/src/components/App.tsx')).toBeUndefined();
    expect(manualChunks('/repo/src/node_modules_like/react/x.ts')).toBeUndefined();
  });

  it('normalizes Windows path separators', () => {
    expect(manualChunks('C:\\repo\\node_modules\\@tauri-apps\\api\\core.js')).toBe('tauri-vendor');
    expect(manualChunks('C:\\repo\\node_modules\\react\\index.js')).toBe('react-vendor');
  });
});
