// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

it('includes executed JavaScript and stylesheet modules in the physical LOC limit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seomi-code-scope-'));
  try {
    const nested = join(directory, 'render'); mkdirSync(nested);
    const script = join(nested, 'capture.js');
    const style = join(directory, 'theme.css');
    writeFileSync(script, 'execute();\n'.repeat(151));
    writeFileSync(style, '/* style line */\n'.repeat(150));
    expect(codeFiles(directory).sort()).toEqual([script, style].sort());
    expect(maxLocReport(codeFiles(directory))).toMatchObject({ files: 2, violations: [{ file: script, lines: 151 }] });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
