import { describe, expect, it } from 'vitest';
import {
  parseAiPromptComparison, parseAiResearchInputs, parseBacklinkGapReport, parseBacklinkProfile,
  parseBacklinkSnapshot, parseBrandAiReport, parseDomainComparison, parseDomainOverview, parseResearchHistory,
} from '@/services/researchContracts';

const overview = { domain: 'example.com', organic_traffic: 0, organic_keywords: null, domain_rank: null, referring_domains: null, top_keywords: [], top_pages: [], competitors: [] };
const comparison = { target: 'example.com', source: 'dataforseo', location_code: 2840, language_code: 'en', retrieved_at: '2026-10-01', rows: [{ domain: 'example.com', organic_traffic: null, organic_keywords: 0, domain_rank: 0, referring_domains: null, retrieved_at: '2026-10-01' }] };
const profile = { domain: 'example.com', total_backlinks: 0, referring_domains: 0, referring_subnets: null, domain_rank: 0, dofollow_ratio: null, total_anchor_rows: null, total_backlink_rows: null, anchors: [], backlinks: [] };
const snapshot = { domain: 'example.com', retrieved_at: '2026-10-01', total_backlinks: 0, referring_domains: null, domain_rank: null, dofollow_ratio: null };
const gap = { target: 'example.com', competitors: [], include_subdomains: true, opportunities: [], total_rows: null, rows_scanned: 0 };
const brand = { brand: 'Brand', domain: 'example.com', overall_score: null, models: [], query_checked: '', timestamp: '2026-10-01', key_takeaways: [] };
const prompt = { prompt: 'Question', captured_at: '2026-10-01', results: [] };
const cases: Array<[string, (value: unknown) => unknown | null, unknown, unknown]> = [
  ['domain overview', parseDomainOverview, overview, { ...overview, top_keywords: [null] }],
  ['domain comparison', parseDomainComparison, comparison, { ...comparison, rows: [null] }],
  ['backlink profile', parseBacklinkProfile, profile, { ...profile, anchors: [null] }],
  ['backlink snapshot', parseBacklinkSnapshot, snapshot, { ...snapshot, total_backlinks: false }],
  ['backlink gap', parseBacklinkGapReport, gap, { ...gap, opportunities: [null] }],
  ['AI brand', parseBrandAiReport, brand, { ...brand, models: [null] }],
  ['AI comparison', parseAiPromptComparison, prompt, { ...prompt, results: [null] }],
];

describe.each(cases)('%s runtime contract', (_name, validate, valid, invalid) => {
  it('preserves a complete valid record and real null/zero values', () => expect(validate(valid)).toEqual(valid));
  it('rejects nested invalid evidence', () => expect(validate(invalid)).toBeNull());
  it.each([null, false, [], 'report', {}])('rejects a non-report %j', (value) => expect(validate(value)).toBeNull());
});

it.each([false, '0', -1, Infinity, NaN])('does not coerce malformed metrics into a measured zero %j', (organic_traffic) => {
  expect(parseDomainOverview({ ...overview, organic_traffic })).toBeNull();
});

it('validates all domain samples and optional comparison evidence', () => {
  const top_keywords = [{ keyword: 'audit', position: 0, search_volume: null, traffic_share: 0, intent: null }];
  const top_pages = [{ url: 'https://example.com', traffic_percentage: null, keywords_count: 0 }];
  const competitors = [{ domain: 'other.example', common_keywords: null, average_position: 0 }];
  expect(parseDomainOverview({ ...overview, top_keywords, top_pages, competitors })).not.toBeNull();
  expect(parseDomainComparison({ ...comparison, rows: [{ ...comparison.rows[0], top_keywords, top_pages, competitors }] })).not.toBeNull();
  for (const patch of [{ top_keywords: [{ ...top_keywords[0], keyword: {} }] }, { top_pages: [{ ...top_pages[0], url: false }] }, { competitors: [{ ...competitors[0], average_position: '0' }] }]) {
    expect(parseDomainOverview({ ...overview, ...patch })).toBeNull();
    expect(parseDomainComparison({ ...comparison, rows: [{ ...comparison.rows[0], ...patch }] })).toBeNull();
  }
});

it('validates nested backlinks and gap competitor counts', () => {
  const backlink = { source_title: '', source_url: 'https://other.example', target_url: 'https://example.com', anchor_text: '', is_dofollow: false, domain_rank: 0, first_seen: '2026-10-01' };
  const anchor = { anchor: '', count: 0, percentage: null };
  const opportunity = { referring_domain: 'other.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'competitor.example', backlinks: 0, rank: null }], max_competitor_spam_score: null };
  expect(parseBacklinkProfile({ ...profile, anchors: [anchor], backlinks: [backlink] })).not.toBeNull();
  expect(parseBacklinkProfile({ ...profile, backlinks: [{ ...backlink, is_dofollow: 'false' }] })).toBeNull();
  expect(parseBacklinkGapReport({ ...gap, opportunities: [opportunity] })).not.toBeNull();
  expect(parseBacklinkGapReport({ ...gap, opportunities: [{ ...opportunity, competitor_backlinks: [null] }] })).toBeNull();
});

it('preserves successful and failed local AI observations without making up presence', () => {
  const common = { model_name: 'Installed CLI', provider: 'openai', connection_method: 'local_cli', captured_at: '2026-10-01', response_status: 'error', error_message: 'Unavailable', prompt: 'Question', repetition: 0, search_mode: 'model_knowledge', mention_position: null, own_domain_cited: false, competitors_mentioned: [] };
  const model = { ...common, model_id: null, is_present: false, visibility_percentage: 0, sentiment: 'not_assessed', summary: '', cited_sources: [] };
  const result = { ...common, response_text: '', brand_mentions: [], citations: [] };
  expect(parseBrandAiReport({ ...brand, models: [model] })).not.toBeNull();
  expect(parseAiPromptComparison({ ...prompt, results: [result] })).not.toBeNull();
  expect(parseBrandAiReport({ ...brand, models: [{ ...model, cited_sources: [null] }] })).toBeNull();
  expect(parseAiPromptComparison({ ...prompt, results: [{ ...result, provider: 'unknown' }] })).toBeNull();
  expect(parseBrandAiReport({ ...brand, models: [{ ...model, connection_method: 'api_key' }] })).toBeNull();
});

it('filters history entries individually and supports the legacy single-report format', () => {
  expect(parseResearchHistory([null, prompt, { ...prompt, results: [null] }], parseAiPromptComparison)).toEqual([prompt]);
  expect(parseResearchHistory(prompt, parseAiPromptComparison)).toEqual([prompt]);
  expect(parseResearchHistory(null, parseAiPromptComparison)).toEqual([]);
  const records = Array.from({ length: 55 }, (_, index) => ({ ...prompt, prompt: String(index) }));
  expect(parseResearchHistory(records, parseAiPromptComparison)).toHaveLength(50);
  expect(parseResearchHistory(records, parseAiPromptComparison, 12, 'last')[0].prompt).toBe('43');
  expect(parseResearchHistory(records, parseAiPromptComparison, 1.9)[0].prompt).toBe('0');
  for (const limit of [0, -1, Infinity, NaN]) expect(parseResearchHistory(records, parseAiPromptComparison, limit)).toEqual([]);
});

it('accepts only string drafts and preserves an intentional empty string', () => {
  expect(parseAiResearchInputs({ brand: '', domain: 'example.com', prompt: 'Question' })).toEqual({ brand: '', domain: 'example.com', prompt: 'Question' });
  expect(parseAiResearchInputs({ brand: false, domain: {}, prompt: 42 })).toEqual({});
  for (const value of [null, [], true, 'text']) expect(parseAiResearchInputs(value)).toEqual({});
});
