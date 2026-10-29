import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve('/Users/tomaszboloz/.codex/worktrees/release-next/seomi/src') } },
  test: { include: ['/tmp/seomi-gemini-20261024-1553/cms-factgate-bypass.repro.test.ts'], environment: 'jsdom', globals: true },
});
