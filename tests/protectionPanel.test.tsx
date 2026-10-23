import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GateBanner } from '@/components/Domain/crawlResults/focus/GateBanner';
import { ProtectionPanel } from '@/components/Domain/crawlResults/focus/ProtectionPanel';
import type { SiteFocusReport } from '@/services/siteFocus';
import { decideProtection } from '@/services/urlProtection';
import { buildUrlTelemetrySnapshot, clearSnapshots, putSnapshot, type UrlTelemetry } from '@/services/urlTelemetry';

const report = (pages: Array<{ url: string; trs: number; skipped?: string }>) => ({ pages } as unknown as SiteFocusReport);
const measured = (clicks: number): UrlTelemetry => ({
  url: 'https://a.com/x', gsc: { state: 'measured', value: { clicks, impressions: 1, position: 1, observedQueryCount: 1, queryCountTruncated: false } },
  ga4: { state: 'measured', value: { sessions: 0, engagedSessions: 0, keyEvents: 0 } }, backlinks: { state: 'measured', value: { referringDomains: 0 } },
  revenue: { state: 'unavailable', value: null },
});

afterEach(() => { cleanup(); clearSnapshots(); });

describe('PRI boundary', () => {
  it('shields at exactly 0.15 and not below', () => {
    expect(decideProtection(10, measured(30)).pri.pri).toBe(0.15);
    expect(decideProtection(10, measured(30)).decision).toBe('shield');
    expect(decideProtection(10, measured(29)).decision).toBe('prune-candidate');
  });
  it('TRS 40 boundary keeps, 39 does not', () => {
    expect(decideProtection(40, measured(0)).decision).toBe('keep');
    expect(decideProtection(39.9, measured(0)).decision).toBe('prune-candidate');
  });
});

describe('ProtectionPanel', () => {
  it('renders nothing without low-TRS pages', () => {
    const { container } = render(<ProtectionPanel report={report([{ url: 'https://a.com/x', trs: 80 }])} projectId="p" />);
    expect(container.firstChild).toBeNull();
  });
  it('shows an empty state and needs-data when no snapshot exists', () => {
    render(<ProtectionPanel report={report([{ url: 'https://a.com/x', trs: 10 }, { url: 'https://a.com/s', trs: 0, skipped: 'noindex' }])} projectId={null} />);
    expect(screen.getByTestId('protection-empty')).toBeTruthy();
    expect(screen.getByText(/needs-data/)).toBeTruthy();
  });
  it('uses the stored snapshot', () => {
    const now = new Date();
    const end = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const start = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
    const snap = buildUrlTelemetrySnapshot({
      projectId: 'p', rootUrl: 'https://a.com/', urls: ['https://a.com/x'], now,
      gsc: { site_url: 'https://a.com/', start_date: start, end_date: end, total_clicks: 0, total_impressions: 0, avg_ctr: 0, avg_position: 0, queries: [], pages: [{ page: 'https://a.com/x', clicks: 90, impressions: 100, ctr: 0.9, position: 2 }], daily: [], daily_may_be_truncated: false, queries_may_be_truncated: false, pages_may_be_truncated: false, max_rows_per_dimension: 1000 },
    })!;
    putSnapshot(snap);
    render(<ProtectionPanel report={report([{ url: 'https://a.com/x/', trs: 10 }])} projectId="p" />);
    expect(screen.queryByTestId('protection-empty')).toBeNull();
    expect(screen.getByText(/decision\.shield/)).toBeTruthy();
  });
});

describe('GateBanner', () => {
  const pages = [{ url: 'https://a.com/n', final_url: 'https://a.com/n', http_status: 200, meta_robots: 'noindex' }];
  it('hides when nothing is gated', () => {
    const { container } = render(<GateBanner report={report([])} pages={[]} included={false} onToggle={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows counter, toggle and conflicts', () => {
    const toggle = vi.fn();
    render(<GateBanner report={report([{ url: 'https://a.com/n', trs: 0, skipped: 'noindex' }])} pages={pages} included={false} onToggle={toggle} sitemapUrls={['https://a.com/n']} />);
    fireEvent.click(screen.getByRole('button', { name: /gateInclude/ }));
    expect(toggle).toHaveBeenCalled();
    expect(screen.getByTestId('gate-conflicts').textContent).toContain('sitemap-noindex');
  });
  it('offers to exclude again when included', () => {
    render(<GateBanner report={report([])} pages={pages} included onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /gateExclude/ })).toBeTruthy();
  });
});
