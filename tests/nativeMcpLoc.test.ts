// @vitest-environment node
import { expect, it } from 'vitest';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

it('keeps MCP discovery, stream bounds, child cleanup and all native tests within LOC150', () => {
  const files = ['src-tauri/src/commands/mcp_discovery.rs',
    ...codeFiles('src-tauri/src/commands/mcp_discovery'),
    'scripts/run-strix-security.mjs'];
  expect(files.length).toBeGreaterThan(10);
  expect(maxLocReport(files).violations).toEqual([]);
});
