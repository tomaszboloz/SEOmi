import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('routes crawler DNS and canonical checks through the native public transport policy', () => {
  const crawler = readFileSync('src-tauri/src/commands/site_crawler.rs', 'utf8');
  const analyzer = readFileSync('src-tauri/src/services/seo_analyzer/indexability.rs', 'utf8');
  expect(crawler.includes('public_client_builder()')).toBe(true);
  expect(analyzer.includes('check_url_status(target.as_str(), 5)')).toBe(true);
  expect(crawler.includes('response.text().await')).toBe(false);
});
