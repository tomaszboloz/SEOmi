import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { codeFiles } from '../scripts/check-max-loc.mjs';

it('routes crawler DNS and canonical checks through the native public transport policy', () => {
  const directory = 'src-tauri/src/commands/site_crawler';
  const crawler = codeFiles(directory)
    .filter(file => file.endsWith('.rs') && !/\/tests\/|\/tests\.rs$|_tests\.rs$/.test(file))
    .map(file => readFileSync(file, 'utf8')).join('\n');
  const analyzer = readFileSync('src-tauri/src/services/seo_analyzer/indexability.rs', 'utf8');
  expect(crawler.includes('public_client_builder()')).toBe(true);
  expect(analyzer.includes('check_url_status(target.as_str(), 5)')).toBe(true);
  expect(crawler.includes('response.text().await')).toBe(false);
});
