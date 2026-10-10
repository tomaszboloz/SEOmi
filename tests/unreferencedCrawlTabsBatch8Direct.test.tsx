import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrawlCrawlerReadinessTab } from '@/components/Domain/crawlResults/CrawlCrawlerReadinessTab';
import { CrawlIssuesTab } from '@/components/Domain/crawlResults/CrawlIssuesTab';
import { CrawlLinksTab } from '@/components/Domain/crawlResults/CrawlLinksTab';
import { CrawlMediaTab } from '@/components/Domain/crawlResults/CrawlMediaTab';
import { CrawlOverviewTab } from '@/components/Domain/crawlResults/CrawlOverviewTab';
import { CrawlUrlsTab } from '@/components/Domain/crawlResults/CrawlUrlsTab';
import { CrawlVisualisationsTab } from '@/components/Domain/crawlResults/CrawlVisualisationsTab';
import { useCrawlResultsSession } from '@/components/Domain/crawlResults/useCrawlResultsSession';
import { result, run } from './fixtures/crawlResultsTabsContracts';

type Session = ReturnType<typeof useCrawlResultsSession>;

function Harness({ renderChild }: { renderChild: (session: Session) => React.ReactNode }) {
  const session = useCrawlResultsSession({
    result,
    runs: [run],
    selectedRun: run,
    onSelectRun: vi.fn(),
  });
  return <>{renderChild(session)}</>;
}

describe('unreferenced crawl tabs batch 8 direct assertions', () => {
  it('renders CrawlCrawlerReadinessTab directly', () => {
    render(
      <Harness renderChild={(session) => <CrawlCrawlerReadinessTab session={session} />} />,
    );
    expect(screen.getByRole('heading', { name: /readiness/i })).toBeTruthy();
  });

  it('renders CrawlIssuesTab directly', () => {
    render(
      <Harness renderChild={(session) => <CrawlIssuesTab session={session} />} />,
    );
    expect(screen.getByText('https://example.com/missing')).toBeTruthy();
    expect(screen.getByText(/HTTP 404 response/i)).toBeTruthy();
  });

  it('renders CrawlLinksTab directly', () => {
    render(
      <Harness renderChild={(session) => <CrawlLinksTab session={session} />} />,
    );
    expect(screen.getByText('https://example.com/missing')).toBeTruthy();
    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: 'does-not-exist' } });
    expect(screen.queryByText('https://example.com/missing')).toBeNull();
  });

  it('renders CrawlMediaTab directly', () => {
    render(
      <Harness renderChild={(session) => <CrawlMediaTab session={session} />} />,
    );
    expect(screen.getByText('https://example.com/logo.webp')).toBeTruthy();
  });

  it('renders CrawlOverviewTab directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlOverviewTab session={session} />} />,
    );
    expect(container.querySelectorAll('tr').length).toBeGreaterThan(0);
  });

  it('renders CrawlUrlsTab directly', () => {
    render(
      <Harness renderChild={(session) => <CrawlUrlsTab session={session} />} />,
    );
    expect(screen.getByTitle('https://example.com/')).toBeTruthy();
  });

  it('renders CrawlVisualisationsTab directly', () => {
    const { container } = render(
      <Harness renderChild={(session) => <CrawlVisualisationsTab session={session} />} />,
    );
    expect(container.querySelector('#crawl-map-section')?.getAttribute('aria-label')).toBeTruthy();
    expect(screen.getByText(/History chart appears after another crawl run/)).toBeTruthy();
  });
});
