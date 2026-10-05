import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { buildTechnicalChecks } from '@/services/auditChecks/securityAndTechnicalChecks';
import type { PageAuditData } from '@/types';

const statuses = (technical?: Record<string, unknown>) => Object.fromEntries(buildTechnicalChecks({ technical } as unknown as PageAuditData).map((c) => [c.id, c.status]));
const tag = (hreflang: string, href = `https://a.test/${hreflang}`) => ({ hreflang, href });

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('technical checks', () => {
  it('handles a missing technical block', () => {
    const s = statuses(undefined);
    expect(s['technical-content-type']).toBe('warning');
    expect(s['technical-favicon']).toBe('warning');
    expect(s['technical-hreflang']).toBe('not_applicable');
  });

  it('passes a complete block', () => {
    const s = statuses({ content_type: 'text/html', favicons: [{ href: 'https://a.test/f.ico' }], robots_txt_url: 'https://a.test/robots.txt', sitemap_url: 'https://a.test/s.xml', hreflang_tags: [tag('en'), tag('pl')], technology_signals: [{ name: 'WP', evidence: 'meta', confidence: 'confirmed' }] });
    expect(Object.values(s).every((v) => v === 'pass')).toBe(true);
  });

  it('accepts the legacy single favicon and rejects favicon entries without href', () => {
    expect(statuses({ favicon: 'https://a.test/f.ico', hreflang_tags: [] })['technical-favicon-absolute']).toBe('pass');
    expect(statuses({ favicons: [{ href: '' }], hreflang_tags: [] })['technical-favicon-absolute']).toBe('warning');
    expect(statuses({ hreflang_tags: [] })['technical-favicon-absolute']).toBe('not_applicable');
  });

  it('flags hreflang entries with empty, relative or duplicated values', () => {
    const s = statuses({ hreflang_tags: [tag('en', ''), tag('en', '/rel')] });
    expect([s['technical-hreflang'], s['technical-hreflang-unique'], s['technical-hreflang-http']]).toEqual(['warning', 'warning', 'warning']);
  });

  it('rates technology signals by completeness and confidence', () => {
    const base = { hreflang_tags: [] };
    expect(statuses({ ...base, technology_signals: [] })['technical-technology-signals']).toBe('not_applicable');
    const weak = statuses({ ...base, technology_signals: [{ name: '', evidence: 'x', confidence: 'guess' }] });
    expect([weak['technical-technology-signals'], weak['technical-technology-confidence']]).toEqual(['warning', 'warning']);
    expect(statuses({ ...base, technology_signals: [{ name: 'a', evidence: 'x', confidence: 'heuristic' }] })['technical-technology-confidence']).toBe('pass');
  });
});
