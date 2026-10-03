import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('separates topical session orchestration, preferences and bounded view panels', () => {
  const entry = readFileSync('src/components/Charts/SemanticTopicalWorkspace.tsx', 'utf8');
  expect(entry).toContain('useSemanticTopicalSession');
  expect(entry.split('\n').length).toBeLessThan(220);
  const directory = 'src/components/Charts/semanticTopical';
  const files = readdirSync(directory).filter((file) => /\.tsx?$/.test(file));
  expect(files.length).toBeGreaterThan(4);
  for (const file of files) {
    const source = readFileSync(`${directory}/${file}`, 'utf8');
    expect(source.split('\n').length, file).toBeLessThan(550);
    if (file.endsWith('.tsx')) expect(source).not.toMatch(/useToolsStore|writeTopicalMap|readTopicalMap/);
  }
});
