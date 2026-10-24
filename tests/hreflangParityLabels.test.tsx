import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import i18n from '@/i18n';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';
import { buildParityReport } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import { compareParity } from '@/services/hreflangParity/parity';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

const row = (language: string, topic: string, status: 'covered' | 'shallow' | 'missing' | 'intentionally-local', label?: string) =>
  ({ language, topic, status, depth: 1, referenceDepth: 5, ...(label ? { label } : {}) });

describe('topic labels in parity', () => {
  it('compareParity copies a label only when one exists for the topic', () => {
    const coverage = new Map([['pl', new Map([['t1', 10], ['t2', 10]])], ['de', new Map([['t1', 10]])]]);
    const report = compareParity({ referenceLanguage: 'pl', coverage, complete: true, topicLabels: new Map([['t1', 'Insulin']]) });
    expect(report.rows.find((r) => r.topic === 't1')?.label).toBe('Insulin');
    expect('label' in (report.rows.find((r) => r.topic === 't2') as object)).toBe(false);
  });

  it('adapter passes cluster labels and skips empty ones', () => {
    const page = (url: string, lang: string, words: number) => ({ url, final_url: url, http_status: 200, document_language: lang, word_count: words }) as unknown as CrawledPageSummary;
    const pages = [page('https://a.test/pl1', 'pl', 100), page('https://a.test/pl2', 'pl', 50), page('https://a.test/de1', 'de', 20)];
    const node = (p: CrawledPageSummary, clusterId: string, clusterLabel: string) => ({ id: p.url, page: p, clusterId, clusterLabel, semanticSignalCount: 0, incomingContentLinks: 0, orphan: false });
    const graph = { nodes: [node(pages[0], 'c1', 'Insulin'), node(pages[1], 'c2', ''), node(pages[2], 'c1', 'Insulin')], edges: [], topicEdges: [] } as unknown as SemanticMap;
    const report = buildParityReport(pages, graph);
    expect(report.status).toBe('ready');
    expect(report.rows.find((r) => r.topic === 'c1')?.label).toBe('Insulin');
    expect(report.rows.find((r) => r.topic === 'c2')?.label).toBeUndefined();
  });
});

describe('parity panel', () => {
  it('shows labels with an id fallback and a status summary', () => {
    render(<HreflangParityPanel report={{ status: 'ready', gaps: [], rows: [row('de', 'c1', 'covered', 'Insulin'), row('de', 'c2', 'shallow'), row('de', 'c3', 'missing'), row('fr', 'c3', 'missing'), row('fr', 'c1', 'intentionally-local')] }} />);
    expect(screen.getByText('1 covered, 1 shallow, 2 missing, 1 intentionally local.')).toBeTruthy();
    expect(screen.getByText('Insulin')).toBeTruthy();
    expect(screen.getByText('c2')).toBeTruthy();
  });

  it('does not show a summary for an inconclusive report', () => {
    render(<HreflangParityPanel report={{ status: 'inconclusive', gaps: ['partial-crawl'], rows: [] }} />);
    expect(screen.queryByText(/covered,/)).toBeNull();
  });

  it('has the summary string with all placeholders in every locale', async () => {
    for (const locale of ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']) {
      const summary = (await import(`@/i18n/locales/${locale}.json`)).default.parityUi.summary as string;
      for (const key of ['covered', 'shallow', 'missing', 'local']) expect(summary, `${locale} ${key}`).toContain(`{{${key}}}`);
    }
  });
});
