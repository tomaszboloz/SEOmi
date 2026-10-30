import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const doc = readFileSync('docs/SEMANTIC_SUITE_STATUS.md', 'utf8');
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** `#57-#62` covers the whole range; single `#n` covers one issue. */
const mentioned = new Set([...doc.matchAll(/#(\d+)(?:-#(\d+))?/g)].flatMap((m) => range(Number(m[1]), Number(m[2] ?? m[1]))));

describe('epic status doc (#77, #124)', () => {
  it('maps every child issue of both epics', () => {
    const children = [...range(52, 73), ...range(76, 103), ...range(125, 134), 137];
    expect(children.filter((issue) => !mentioned.has(issue))).toEqual([]);
  });

  it('points only at code paths that exist', () => {
    const paths = [...doc.matchAll(/`((?:src|docs)\/[^`\s]+)`/g)].map((m) => m[1].replace(/\/$/, ''));
    expect(paths.length).toBeGreaterThan(10);
    expect(paths.filter((path) => !existsSync(path))).toEqual([]);
  });

  it('makes no completion claim', () => {
    expect(doc).toContain('No 72/72 or 100% claim');
    expect(doc).not.toMatch(/- \[x\]/i);
  });
});
