import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('separates crawl results session, navigation and individual tab views', () => {
  const entry = readFileSync('src/components/Domain/CrawlResultsTabs.tsx', 'utf8');
  expect(entry).toContain('useCrawlResultsSession');
  expect(entry.split('\n').length).toBeLessThan(400);
  const directory = 'src/components/Domain/crawlResults';
  const files = readdirSync(directory).filter(file => /\.tsx?$/.test(file));
  expect(files.length).toBeGreaterThan(20);
  for (const file of files) {
    const source = readFileSync(`${directory}/${file}`, 'utf8');
    expect(source.split('\n').length, file).toBeLessThan(file.startsWith('use') ? 950 : 550);
    if (file.endsWith('.tsx')) expect(source).not.toMatch(/useToolsStore|readJsonStorage|writeJsonStorage/);
  }
});
