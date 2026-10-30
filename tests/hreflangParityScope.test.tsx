import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';
import { buildParityReport } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import { parityExceptionsKey, readParityExceptions, setParityExceptionReason, toggleParityException } from '@/services/hreflangParity/exceptions';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

const page = (url: string, lang: string, words: number, hreflangs: Array<[string, string]> = []) =>
  ({ url, word_count: words, document_language: lang, hreflangs: hreflangs.map(([language, target_url]) => ({ language, target_url })) }) as unknown as CrawledPageSummary;
const graphOf = (pages: CrawledPageSummary[], topic: (p: CrawledPageSummary) => string): SemanticMap =>
  ({ truncated: false, nodes: pages.map((p) => ({ id: p.url, page: p, clusterId: topic(p), clusterLabel: topic(p) === 't1' ? 'Insulin' : '' })), edges: [], topicEdges: [] }) as unknown as SemanticMap;

const pair: Array<[string, string]> = [['en', 'https://a.test/en'], ['de', 'https://a.test/de'], ['x-default', 'https://a.test/en']];

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('parity restricted to hreflang clusters', () => {
  it('compares only clustered pages and takes their language from the annotation', () => {
    const pages = [
      page('https://a.test/en', 'en', 400, pair), page('https://a.test/en-b', 'en', 0, pair), page('https://a.test/de', '', 100, pair),
      page('https://a.test/blog-de', 'de', 900), page('https://a.test/blog-de2', 'de', 900),
    ];
    const report = buildParityReport(pages, graphOf(pages, () => 't1'));
    expect(report.scope).toBe('hreflang-clusters');
    expect(report.clusters).toBe(1);
    expect(report.graphIssues).toBe(1); // en-b does not reference itself
    expect(report.rows).toEqual([expect.objectContaining({ language: 'de', depth: 100, referenceDepth: 400, status: 'shallow', label: 'Insulin' })]);
  });

  it('falls back to document language without any hreflang and counts graph issues separately', () => {
    const plain = [page('https://a.test/en', 'en', 400), page('https://a.test/de', 'de', 400)];
    expect(buildParityReport(plain, graphOf(plain, () => 't1')).scope).toBe('document-language');
    const broken = [page('https://a.test/en', 'en', 400, [['de', 'https://a.test/de']]), page('https://a.test/de', 'de', 400)];
    expect(buildParityReport(broken, graphOf(broken, () => 't1')).graphIssues).toBeGreaterThan(0);
  });

  it('applies user exceptions by topic label and keeps the documented reason', () => {
    const pages = [page('https://a.test/en', 'en', 400, pair), page('https://a.test/en2', 'en', 50, pair), page('https://a.test/de', 'de', 100, pair)];
    const topic = (p: CrawledPageSummary) => (p.url.endsWith('en2') ? 't2' : 't1');
    const exceptions = { de: { t2: { reason: 'Not sold in DE', createdAt: '2026-10-30T00:00:00Z' } } };
    const report = buildParityReport(pages, graphOf(pages, topic), exceptions);
    expect(report.rows.find((r) => r.topic === 't2')).toMatchObject({ status: 'intentionally-local', reason: 'Not sold in DE' });
    expect(report.rows.find((r) => r.topic === 't1')?.status).toBe('shallow');
  });
});

describe('exception store and panel', () => {
  it('toggles, documents and validates exceptions per project', () => {
    expect(toggleParityException(null, 'de', 'x')).toBe(false);
    expect(toggleParityException('p1', 'de', 'Insulin', ' local offer ', '2026-10-30T00:00:00Z')).toBe(true);
    expect(readParityExceptions('p1')).toEqual({ de: { Insulin: { reason: 'local offer', createdAt: '2026-10-30T00:00:00Z' } } });
    expect(setParityExceptionReason('p1', 'de', 'Insulin', 'new reason')).toBe(true);
    expect(setParityExceptionReason('p1', 'fr', 'Insulin', 'x')).toBe(false);
    expect(readParityExceptions('p1').de.Insulin.reason).toBe('new reason');
    toggleParityException('p1', 'de', 'Insulin');
    expect(readParityExceptions('p1')).toEqual({});
    localStorage.setItem(parityExceptionsKey('p2'), '{"de":{"x":{"reason":5}}}');
    expect(readParityExceptions('p2')).toEqual({});
    expect(readParityExceptions(null)).toEqual({});
  });

  it('renders scope, exception buttons and reason inputs', () => {
    const calls: string[] = [];
    const handlers = { onToggle: (l: string, k: string) => calls.push(`t:${l}:${k}`), onReason: (l: string, k: string, r: string) => calls.push(`r:${l}:${k}:${r}`) };
    const rows = [
      { language: 'de', topic: 't1', label: 'Insulin', status: 'missing' as const, depth: 0, referenceDepth: 5 },
      { language: 'de', topic: 't2', status: 'intentionally-local' as const, depth: 0, referenceDepth: 5, reason: 'Local offer' },
    ];
    render(<HreflangParityPanel report={{ status: 'ready', gaps: [], rows, scope: 'hreflang-clusters', clusters: 2, graphIssues: 1 }} exceptions={handlers} />);
    expect(screen.getByText(/2 hreflang clusters/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Insulin/ }));
    const input = screen.getByRole('textbox');
    fireEvent.blur(input, { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: /t2/ }));
    expect(calls).toEqual(['t:de:Insulin', 'r:de:t2:Changed', 't:de:t2']);
  });
});
