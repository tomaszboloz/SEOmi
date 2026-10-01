import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('separates native crawler models, policies, extraction, transport and orchestration', () => {
  const entry = readFileSync('src-tauri/src/commands/site_crawler.rs', 'utf8');
  expect(entry.includes('mod orchestration')).toBe(true);
  expect(entry.split('\n').length).toBeLessThan(200);
  const directory = 'src-tauri/src/commands/site_crawler';
  const files = readdirSync(directory).filter(file => file.endsWith('.rs'));
  expect(files.length).toBeGreaterThan(10);
  for (const file of files.filter(file => file !== 'tests.rs')) {
    const source = readFileSync(`${directory}/${file}`, 'utf8');
    expect(source.split('\n').length, file).toBeLessThan(file === 'orchestration.rs' ? 2500 : 1100);
  }
});
