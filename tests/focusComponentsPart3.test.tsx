import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import i18n from '@/i18n';
import { buildSiteFocusReport } from '@/services/siteFocus';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import { CrawlFocusTab } from '@/components/Domain/crawlResults/focus/CrawlFocusTab';






import { PageFocusDetail } from '@/components/Domain/crawlResults/focus/PageFocusDetail';
import { SiteRecommendations } from '@/components/Domain/crawlResults/focus/SiteRecommendations';
import { SubSiteScores } from '@/components/Domain/crawlResults/focus/SubSiteScores';


import { diabetesSite, multiTopicSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const report = buildSiteFocusReport(diabetesSite(), START);
const worst = [...report.pages].filter((p) => !p.skipped).sort((a, b) => a.trs - b.trs)[0];
const best = [...report.pages].filter((p) => !p.skipped).sort((a, b) => b.trs - a.trs)[0];


beforeEach(async () => {
  await i18n.changeLanguage('en');
});


describe('PageFocusDetail', () => {
  it('covers similarity levels and an empty keyword page without brief for type C', () => {
    const base: PageFocus = { ...best, foreignClusters: [], offTopicKeywords: [], keywordsFound: [], alignment: [] };
    const { rerender } = render(<PageFocusDetail page={{ ...base, similarity: 90, playbook: 'C' }} report={report} onBack={vi.fn()} />);
    expect(screen.getByText(/strong\)/)).toBeTruthy();
    expect(screen.queryByTestId('focus-brief')).toBeNull();
    expect(screen.getByText('No foreign topics detected.')).toBeTruthy();
    expect(screen.getAllByText('None found.')).toHaveLength(2);
    rerender(<PageFocusDetail page={{ ...base, similarity: 60, playbook: 'B', trs: 65 }} report={report} onBack={vi.fn()} />);
    expect(screen.getByText(/moderate\)/)).toBeTruthy();
    rerender(<PageFocusDetail page={{ ...base, similarity: 10, playbook: 'B', trs: 65 }} report={report} onBack={vi.fn()} />);
    expect(screen.getByText(/weak\)/)).toBeTruthy();
  });

  it('handles skipped and degraded pages', () => {
    render(<PageFocusDetail page={{ ...worst, skipped: 'render-timeout', degraded: true }} report={report} onBack={vi.fn()} />);
    expect(screen.getByText('This page was not scored: JavaScript rendering timed out.')).toBeTruthy();
    expect(screen.getByText(/limited data/)).toBeTruthy();
    expect(screen.queryByText('Why this score?')).toBeNull();
  });

  it('shows empty brief fields as none', () => {
    const page: PageFocus = { ...worst, offTopicKeywords: [] };
    const empty = { ...report, coreTopic: { ...report.coreTopic, terms: [] } };
    render(<PageFocusDetail page={page} report={empty} onBack={vi.fn()} />);
    expect(within(screen.getByTestId('focus-brief')).getAllByText(/None found\./).length).toBeGreaterThan(1);
  });
});

describe('SiteRecommendations and SubSiteScores', () => {
  it('lists recommendations with delta, urls, gaps and links', () => {
    const rich: SiteFocusReport = {
      ...report,
      recommendations: [
        { code: 'remove-offtopic', params: { count: 2, gain: 4.2 }, deltaScore: 4.2, effort: { minHours: 1, maxHours: 2, estimate: true }, ratio: 1, urls: ['https://x.test/a'] },
        { code: 'monitor-strong-pages', params: { count: 3 }, deltaScore: 0, effort: { minHours: 1, maxHours: 2, estimate: true }, ratio: 0, urls: [] },
      ],
      gaps: [{ code: 'thin-subtopic', label: 'foot care', terms: ['foot', 'care'], coveragePct: 5, pagesCovering: 1 }],
      linkSuggestions: [{ code: 'link-to-hub', fromUrl: 'https://x.test/a', toUrl: 'https://x.test/', anchors: ['insulin'] }],
    };
    render(<SiteRecommendations report={rich} />);
    expect(screen.getByText('Review 2 off-topic pages')).toBeTruthy();
    expect(screen.getByText('Delta Score: +4.2')).toBeTruthy();
    expect(screen.getByText('Delta Score: 0')).toBeTruthy();
    expect(screen.getByText(/Thin subtopic "foot care"/)).toBeTruthy();
    expect(screen.getByText(/Link from https:\/\/x.test\/a to the hub/)).toBeTruthy();
    expect(screen.getByText('https://x.test/a')).toBeTruthy();
  });

  it('shows empty states', () => {
    render(<SiteRecommendations report={{ ...report, recommendations: [], gaps: [], linkSuggestions: [] }} />);
    expect(screen.getByText('No recommendations. The site stays on topic.')).toBeTruthy();
    expect(screen.getByText('No topic gaps found.')).toBeTruthy();
    expect(screen.getByText('No link suggestions.')).toBeTruthy();
  });

  it('renders sub-site scores or nothing', () => {
    const { container, rerender } = render(<SubSiteScores subSites={[]} />);
    expect(container.firstChild).toBeNull();
    rerender(<SubSiteScores subSites={[{ label: 'Phones', pathPrefix: '/phones', sharePct: 30, score: 55 }]} />);
    expect(screen.getByText('Phones (/phones): 30% of pages')).toBeTruthy();
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('55');
  });
});

describe('CrawlFocusTab', () => {
  it('shows an empty state without pages', () => {
    render(<CrawlFocusTab pages={[]} startUrl={START} />);
    expect(screen.getByText('No pages with content to analyse. Run a crawl first.')).toBeTruthy();
  });

  it('computes the report, opens a page, goes back, applies an override and recalculates', () => {
    const pages = diabetesSite(undefined, 6);
    const onReport = vi.fn();
    render(<CrawlFocusTab pages={pages} startUrl={START} onReport={onReport} benchmark={<p>bench</p>} historySlot={<p>hist</p>} />);
    expect(screen.getByText('bench')).toBeTruthy();
    expect(screen.getByText('hist')).toBeTruthy();
    expect(onReport).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^Critical <40/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /^Open page analysis/ })[0]);
    expect(screen.getByText('Why this score?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the list' }));
    expect(screen.getByText('Topic distribution')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Is this the wrong topic?' }));
    fireEvent.change(screen.getByLabelText('Your topic (words or phrase)'), { target: { value: 'smartphone battery camera' } });
    expect(screen.getByText(/Manual topic: smartphone battery camera/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to detected topic' }));
    expect(screen.queryByText(/Manual topic:/)).toBeNull();
    const calls = onReport.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Analysis details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(onReport.mock.calls.length).toBeGreaterThan(calls);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ignore technical pages' }));
  });

  it('shows sub-site scores for multi-topic sites', () => {
    render(<CrawlFocusTab pages={multiTopicSite()} startUrl="https://shop.test/" />);
    expect(screen.getByText('Sub-site scores')).toBeTruthy();
  });
});
