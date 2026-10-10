import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrawlerReadinessPanel } from '@/components/Results/CrawlerReadinessPanel';
import { KeywordClusteringForm } from '@/components/Keywords/keywordClustering/KeywordClusteringForm';
import { RankTrackingTable } from '@/components/Keywords/rankTracking/RankTrackingTable';
import { AiCitationEvidenceList } from '@/components/AiVisibility/searchPrompts/AiCitationEvidenceList';
import { DomainComparisonHistory } from '@/components/Domain/domainOverview/DomainComparisonHistory';
import type { SiteCrawlResult } from '@/types';

const t = ((k: string) => k) as any;

describe('unreferenced components batch 7 direct assertions', () => {
  it('CrawlerReadinessPanel renders readiness report section', () => {
    const result: SiteCrawlResult = {
      start_url: 'https://example.com/',
      pages_crawled: 1,
      health_score: 90,
      critical_count: 0,
      warning_count: 0,
      notice_count: 0,
      pages: [],
      issues: [],
      duration_ms: 100,
    } as unknown as SiteCrawlResult;

    render(<CrawlerReadinessPanel result={result} />);
    expect(screen.getByText(/Crawl and AI-system readiness/i)).toBeDefined();
  });

  it('CrawlerReadinessPanel promotes an unknown robots result to a run warning', () => {
    const result = {
      start_url: 'https://example.com/', pages_crawled: 0, health_score: 90,
      critical_count: 0, warning_count: 0, notice_count: 0, pages: [], duration_ms: 100,
      robots_txt_status: 'robots.txt could not be evaluated', robots_txt_evaluation_status: 'unknown',
      robots_txt_warning: 'Robots rules could not be evaluated.', robots_blocked_count: 0,
    } as unknown as SiteCrawlResult;
    render(<CrawlerReadinessPanel result={result} />);
    expect(screen.getByRole('alert').textContent).toContain('Robots rules could not be evaluated.');
  });

  it('KeywordClusteringForm renders clustering controls', () => {
    const runClustering = vi.fn();
    const { rerender } = render(
      <KeywordClusteringForm
        session={{ keywordInput: '', country: 'US', language: 'en', similarityThreshold: 0.8 } as any}
        keywords={[]}
        credentials={{}}
        currentResearch={[]}
        savedKeywords={[]}
        isRunning={false}
        progress={0}
        error={null}
        updateSession={vi.fn()}
        appendKeywords={vi.fn()}
        changeCountry={vi.fn()}
        runClustering={runClustering}
        t={t}
      />,
    );
    const runButton = screen.getByRole('button', { name: /keywordClusteringUi.run/i });
    expect((runButton as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <KeywordClusteringForm
        session={{ keywordInput: '', country: 'US', language: 'en', similarityThreshold: 0.8 } as any}
        keywords={['seo', 'audit']}
        credentials={{ login: 'user', password: 'secret' }}
        currentResearch={[]}
        savedKeywords={[]}
        isRunning={false}
        progress={0}
        error={null}
        updateSession={vi.fn()}
        appendKeywords={vi.fn()}
        changeCountry={vi.fn()}
        runClustering={runClustering}
        t={t}
      />,
    );
    const enabledRunButton = screen.getByRole('button', { name: /keywordClusteringUi.run/i });
    expect((enabledRunButton as HTMLButtonElement).disabled).toBe(false);
    enabledRunButton.click();
    expect(runClustering).toHaveBeenCalledOnce();
  });

  it('RankTrackingTable renders table columns', () => {
    render(<RankTrackingTable trackedRanks={[]} onRemove={vi.fn()} t={t} />);
    expect(screen.getByRole('columnheader', { name: 'rankTrackingUi.keywordQuery' })).toBeTruthy();
  });

  it('AiCitationEvidenceList renders citation label', () => {
    render(
      <AiCitationEvidenceList
        provider="perplexity"
        citations={['https://example.com/source']}
        summary={undefined}
        evidenceList={[]}
        sourceContextRun={null}
        t={t}
      />,
    );
    expect(screen.getByText('aiVisibility.search.citationsLabel')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'https://example.com/source' }).getAttribute('href')).toBe('https://example.com/source');
  });

  it('DomainComparisonHistory renders when history is non-empty', () => {
    const history = [{ retrieved_at: '2026-10-06T12:00:00Z', domains: [] }] as any;
    const comparison = { domainA: 'a.com', domainB: 'b.com', rows: [] } as any;

    const { container } = render(
      <DomainComparisonHistory comparison={comparison} history={history} t={t} />,
    );
    expect(container.querySelector('section')?.textContent).toContain('domainResearchUi.historyTitle');
  });
});
