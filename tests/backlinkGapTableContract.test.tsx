import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacklinkGapTable } from '@/components/Domain/backlinkChecker/BacklinkGapTable';
import { downloadBacklinkGapCsv } from '@/services/export';
import type { BacklinkGapReport } from '@/types';
import i18n from '@/i18n';

vi.mock('@/services/export', () => ({ downloadBacklinkGapCsv: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const report: BacklinkGapReport = {
  target: 'target.test', competitors: ['competitor.test'], include_subdomains: false,
  rows_scanned: 1, total_rows: 2,
  opportunities: [{ referring_domain: 'referring.test', target_backlinks: 0,
    competitor_backlinks: [{ domain: 'competitor.test', backlinks: 100, rank: null }],
    max_competitor_spam_score: null }],
};

describe('public backlink gap table', () => {
  it('shows observed opportunities, unknown metrics and exports the exact report', () => {
    const loadMore = vi.fn();
    render(<BacklinkGapTable report={report} isLoading={false} loadMore={loadMore} t={i18n.t} />);
    expect(screen.getByText('referring.test')).toBeTruthy();
    expect(screen.getByText('competitor.test')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('backlinkUi.exportCsv') }));
    expect(downloadBacklinkGapCsv).toHaveBeenCalledExactlyOnceWith(report);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('backlinkUi.loadMoreGap') }));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('disables duplicate paging while loading and hides paging when counts are unknown or exhausted', () => {
    const loadMore = vi.fn();
    const view = render(<BacklinkGapTable report={report} isLoading loadMore={loadMore} t={i18n.t} />);
    const loading = screen.getByRole('button', { name: i18n.t('backlinkUi.loading') });
    expect((loading as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(loading); expect(loadMore).not.toHaveBeenCalled();
    for (const total_rows of [null, 1]) {
      view.rerender(<BacklinkGapTable report={{ ...report, total_rows }} isLoading={false} loadMore={loadMore} t={i18n.t} />);
      expect(screen.queryByRole('button', { name: i18n.t('backlinkUi.loadMoreGap') })).toBeNull();
    }
  });

  it('renders real zero opportunities and supplied rank/spam values without invented rows', () => {
    const view = render(<BacklinkGapTable report={{ ...report, opportunities: [], total_rows: null }} isLoading={false} loadMore={vi.fn()} t={i18n.t} />);
    expect(screen.getByText(i18n.t('backlinkUi.noGaps'))).toBeTruthy();
    expect(screen.queryByText('referring.test')).toBeNull();
    const opportunity = { ...report.opportunities[0], max_competitor_spam_score: 17,
      competitor_backlinks: [{ domain: 'competitor.test', backlinks: 5, rank: 24 }] };
    view.rerender(<BacklinkGapTable report={{ ...report, opportunities: [opportunity] }} isLoading={false} loadMore={vi.fn()} t={i18n.t} />);
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByText(`5 · ${i18n.t('backlinkUi.rank')} 24`)).toBeTruthy();
  });
});
