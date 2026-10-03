import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps native HTML extraction domains separate from document assembly', () => {
  const root = 'src-tauri/src/services/html_parser';
  for (const domain of ['accessibility', 'content', 'markup', 'structured_data', 'technologies']) {
    expect(existsSync(`${root}/${domain}.rs`), domain).toBe(true);
    expect(readFileSync(`${root}/${domain}.rs`, 'utf8').includes('use super::*')).toBe(false);
  }
  const assembly = readFileSync(`${root}.rs`, 'utf8');
  expect(assembly.includes('fn extract_accessibility(')).toBe(false);
  expect(assembly.includes('fn extract_content_stats(')).toBe(false);
  expect(assembly.includes('pub fn parse_html(')).toBe(true);
});

it('separates native SEO rules from report orchestration', () => {
  const root = 'src-tauri/src/services/seo_analyzer';
  for (const domain of ['accessibility', 'headings', 'images', 'indexability', 'links', 'metadata', 'scoring', 'transport_security']) {
    expect(existsSync(`${root}/${domain}.rs`), domain).toBe(true);
    expect(readFileSync(`${root}/${domain}.rs`, 'utf8').includes('use super::*')).toBe(false);
  }
  const assembly = readFileSync(`${root}.rs`, 'utf8');
  expect(assembly.includes('fn parse_images(')).toBe(false);
  expect(assembly.includes('fn calculate_health_score(')).toBe(false);
  expect(assembly.includes('pub async fn analyze_page(')).toBe(true);
});
