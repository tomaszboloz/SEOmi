import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { normalizeRankTrackingMarketDraft } from '@/components/Keywords/rankTracking/rankTrackingTypes';
import { RankTrackingHeader } from '@/components/Keywords/rankTracking/RankTrackingHeader';
import { RankTrackingStatsCards } from '@/components/Keywords/rankTracking/RankTrackingStatsCards';
import { RankTrackingTableRow } from '@/components/Keywords/rankTracking/RankTrackingTableRow';
import { RankTrackingAddModal } from '@/components/Keywords/rankTracking/RankTrackingAddModal';
import { RankTracking } from '@/components/Keywords/RankTracking';
import { useToolsStore } from '@/stores/toolsStore';
import { codeFiles, maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts.count !== 'undefined') return `${key}:${opts.count}`;
  return key;
}) as any;

describe('RankTracking modular architecture', () => {
  it('satisfies physical LOC <= 150 across RankTracking and submodules', () => {
    const files = [
      'src/components/Keywords/RankTracking.tsx',
      ...codeFiles('src/components/Keywords/rankTracking'),
    ];
    expect(files.length).toBe(8);
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('normalizes market draft properly', () => {
    const normalized = normalizeRankTrackingMarketDraft('US', 'en');
    expect(normalized.location).toBe('US');
    expect(typeof normalized.language).toBe('string');
  });

  it('renders RankTrackingHeader and invokes callbacks', () => {
    const onRefreshAll = vi.fn();
    const onOpenAddModal = vi.fn();
    render(
      <RankTrackingHeader
        totalTracked={5}
        isRankLoading={false}
        onRefreshAll={onRefreshAll}
        onOpenAddModal={onOpenAddModal}
        t={mockT}
      />,
    );
    expect(screen.getByText('rankTrackingUi.title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /rankTrackingUi.trackKeyword/i }));
    expect(onOpenAddModal).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /rankTrackingUi.checkAll/i }));
    expect(onRefreshAll).toHaveBeenCalled();
  });

  it('renders RankTrackingStatsCards with statistics', () => {
    render(
      <RankTrackingStatsCards
        totalTracked={12}
        measuredCount={10}
        inTop3={3}
        inTop10={7}
        avgPosition="4.2"
        t={mockT}
      />,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('4.2')).toBeTruthy();
  });

  it('renders RankTrackingTableRow and calls onRemove', () => {
    const onRemove = vi.fn();
    const mockRank: any = {
      id: 'rank-1',
      keyword: 'best seo tools',
      domain: 'seomi.org',
      target_url: 'https://seomi.org/features',
      location: 'US',
      language_code: 'en',
      current_rank: 2,
      delta: 1,
      best_rank: 1,
      history: [{ date: '2026-01-01', rank: 3 }, { date: '2026-01-02', rank: 2 }],
    };
    render(
      <table>
        <tbody>
          <RankTrackingTableRow rank={mockRank} onRemove={onRemove} t={mockT} />
        </tbody>
      </table>,
    );
    expect(screen.getByText('best seo tools')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    fireEvent.click(screen.getByTitle('rankTrackingUi.removeTracking'));
    expect(onRemove).toHaveBeenCalledWith('rank-1');
  });

  it('renders RankTrackingAddModal and closes on cancel', () => {
    const onClose = vi.fn();
    const onUpdateDraft = vi.fn();
    const onSubmit = vi.fn();
    render(
      <RankTrackingAddModal
        isOpen={true}
        draft={{ keyword: 'audit tool', domain: 'seomi.org', targetUrl: '', location: 'US', language: 'en' }}
        selectedMarket={undefined}
        onUpdateDraft={onUpdateDraft}
        onSubmit={onSubmit}
        onClose={onClose}
        t={mockT}
      />,
    );
    expect(screen.getByText('rankTrackingUi.trackNew')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /rankTrackingUi.cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders RankTracking with error and opens/closes add modal', () => {
    useToolsStore.setState({
      rankError: 'Sample rank error message',
      trackedRanks: [],
    });
    render(<RankTracking />);
    expect(screen.getByText('Sample rank error message')).toBeTruthy();

    const openModalBtn = screen.getByRole('button', { name: /track keyword|rankTrackingUi\.trackKeyword/i });
    fireEvent.click(openModalBtn);

    const cancelBtn = screen.getByRole('button', { name: /cancel|rankTrackingUi\.cancel/i });
    fireEvent.click(cancelBtn);
  });
});
