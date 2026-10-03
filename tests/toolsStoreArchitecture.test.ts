import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('composes typed tool slices and keeps domain actions outside the store entry', () => {
  const entry = readFileSync('src/stores/toolsStore.ts', 'utf8');
  expect(entry.includes('createCrawlSlice')).toBe(true);
  expect(entry.split('\n').length).toBeLessThan(80);
  const directory = 'src/stores/tools';
  const files = readdirSync(directory).filter(file => file.endsWith('.ts'));
  expect(files.length).toBeGreaterThan(10);
  for (const file of files) {
    expect(readFileSync(`${directory}/${file}`, 'utf8').split('\n').length, file).toBeLessThan(600);
  }
});
