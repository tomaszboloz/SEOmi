import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop privilege boundary', () => {
  it('grants privileged plugins only to the main bundled window', () => {
    const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));
    expect(capability.windows).toEqual(['main']);
    expect(capability.remote).toBeUndefined();
    expect(capability.permissions).toContain('updater:default');
  });
});
