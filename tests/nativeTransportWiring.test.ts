import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';

it('routes crawler DNS and canonical checks through the native public transport policy', () => {
  const directory = 'src-tauri/src/commands/site_crawler';
  const crawler = readdirSync(directory)
    .filter(file => file.endsWith('.rs') && file !== 'tests.rs')
    .map(file => readFileSync(`${directory}/${file}`, 'utf8')).join('\n');
  const analyzer = readFileSync('src-tauri/src/services/seo_analyzer/indexability.rs', 'utf8');
  expect(crawler.includes('public_client_builder()')).toBe(true);
  expect(analyzer.includes('check_url_status(target.as_str(), 5)')).toBe(true);
  expect(crawler.includes('response.text().await')).toBe(false);
});
