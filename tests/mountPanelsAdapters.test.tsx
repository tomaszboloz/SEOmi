import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildSprsReport } from '@/components/Charts/semanticTopical/signals/sprsAdapter';
import { buildParityReport } from '@/components/Charts/semanticTopical/signals/parityAdapter';
import { buildTemplateEvents } from '@/components/Charts/semanticTopical/signals/templateAdapter';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { buildOffPageReports } from '@/components/Domain/backlinkChecker/useOffPageReports';
import { BacklinkOutreachSection } from '@/components/Domain/backlinkChecker/BacklinkOutreachSection';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { BacklinkGapReport, BacklinkProfileData, CrawledPageSummary } from '@/types';

const page = (url: string, lang: string, words = 100, excerpt?: string) =>
  ({ url, final_url: url, word_count: words, document_language: lang, semantic_excerpts: excerpt ? [excerpt] : [] }) as unknown as CrawledPageSummary;

const graphOf = (pages: CrawledPageSummary[], edges: Array<[string, string]> = [], truncated = false): SemanticMap => ({
  nodes: pages.map((p) => ({ id: p.url, page: p, clusterId: 'c1', clusterLabel: 'c1', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false })),
  edges: edges.map(([source, target]) => ({ id: `${source}>${target}`, source, target, anchors: [], links: 1 })),
  topicEdges: [], totalEdges: edges.length, totalTopicEdges: 0, totalInternalLinks: edges.length,
  clusters: [], hasSemanticTerms: false, truncated,
});

describe('signals adapters', () => {
  it('SPRS is unavailable without nodes and ready with a link graph', () => {
    expect(buildSprsReport(graphOf([])).status).toBe('unavailable');
    const pages = [page('https://a/', 'en'), page('https://a/b', 'en')];
    const report = buildSprsReport(graphOf(pages, [['https://a/', 'https://a/b']]));
    expect(report.status).toBe('ready');
    expect(report.pages).toHaveLength(2);
  });

  it('parity is inconclusive for a single-language crawl and ready for two', () => {
    const one = [page('https://a/', 'en')];
    expect(buildParityReport(one, graphOf(one)).status).toBe('inconclusive');
    const two = [page('https://a/', 'en', 500), page('https://a/pl', 'pl-PL', 100)];
    const report = buildParityReport(two, graphOf(two));
    expect(report.status).toBe('ready');
    expect(report.rows[0]).toMatchObject({ language: 'pl', status: 'shallow' });
    expect(buildParityReport(two, graphOf(two, [], true)).gaps).toContain('partial-crawl');
  });

  it('template events need excerpts and a large cluster', () => {
    expect(buildTemplateEvents([page('https://a/x-1', 'en')])).toEqual([]);
    const many = Array.from({ length: 10 }, (_, i) => page(`https://a/city-${i}`, 'en', 1, 'same words same words'));
    expect(buildTemplateEvents(many).length).toBeGreaterThan(0);
  });

  it('mounts all signal panels with empty states for missing producers', () => {
    const pages = [page('https://a/', 'en')];
    render(<SignalsWorkspace pages={pages} graph={graphOf(pages)} />);
    expect(screen.getByTestId('signals-workspace')).toBeTruthy();
    expect(screen.getByTestId('template-governor-panel')).toBeTruthy();
    expect(screen.getByTestId('causal-impact-panel')).toBeTruthy();
  });
});

describe('backlink adapters', () => {
  it('off-page reports count nofollow links and never invent a TBVA', () => {
    const profile = { backlinks: [
      { source_url: 'https://x.com/1', domain_rank: 50, is_dofollow: true },
      { source_url: 'https://y.com/1', domain_rank: 40, is_dofollow: false },
    ] } as unknown as BacklinkProfileData;
    const { tbva, coCitation } = buildOffPageReports(profile);
    expect(tbva.tbva).toBeNull();
    expect(tbva.nofollow).toBe(1);
    expect(coCitation.note).toBe('no-source-text');
    expect(buildOffPageReports(null).tbva.tbva).toBeNull();
  });

  it('outreach section lists gap domains and is empty without a report', () => {
    const { unmount } = render(<BacklinkOutreachSection report={null} />);
    expect(screen.getByTestId('outreach-panel')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
    unmount();
    const report: BacklinkGapReport = {
      target: 'me.com', competitors: ['a.com'], include_subdomains: false, total_rows: 1, rows_scanned: 1,
      opportunities: [{ referring_domain: 'blog.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'a.com', backlinks: 3, rank: 50 }], max_competitor_spam_score: null }],
    };
    render(<BacklinkOutreachSection report={report} />);
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy();
  });
});
