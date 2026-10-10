import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RankTrackingTableRow } from '@/components/Keywords/rankTracking/RankTrackingTableRow';
import type { TrackedRankItem } from '@/types';
import i18n from '@/i18n';

const t = ((key: string, value?: unknown) => {
  if (typeof value === 'string') return key;
  return value && typeof value === 'object' ? `${key}:${JSON.stringify(value)}` : key;
}) as any;

const baseRank: TrackedRankItem = {
  id: 'rank-1',
  keyword: 'seo tools',
  domain: 'example.test',
  target_url: 'https://example.test/page',
  location: 'US',
  language_code: 'en',
  current_rank: 2,
  previous_rank: 3,
  delta: 1,
  best_rank: 1,
  history: [{ date: '2026-10-01', rank: 3 }, { date: '2026-10-02', rank: 2 }],
  last_checked: '2026-10-02T00:00:00Z',
};

const show = (patch: Partial<TrackedRankItem> = {}) => {
  const onRemove = vi.fn();
  const rank = { ...baseRank, ...patch };
  const view = render(
    <table>
      <tbody><RankTrackingTableRow rank={rank} onRemove={onRemove} t={t} /></tbody>
    </table>,
  );
  return { ...view, rank, onRemove, cells: view.container.querySelectorAll('td') };
};

describe('RankTrackingTableRow direct contracts', () => {
  it('renders resolved market/language, top-three rank, positive delta and history', () => {
    const { cells } = show();
    expect(cells[2].textContent).toContain('United States · English');
    expect(cells[3].textContent).toBe('#2');
    expect(cells[3].querySelector('span')!.className).toContain('bg-amber-500/10');
    expect(cells[4].textContent).toContain('+1');
    expect(cells[4].querySelector('span')!.className).toContain('text-emerald-400');
    expect(cells[5].textContent).toBe('#1');
    expect(screen.getByRole('img', { name: /rankTrackingUi\.historyAria/ })).toBeTruthy();
  });

  it('covers unknown market, missing language/rank/best values and null delta', () => {
    const { cells, onRemove } = show({
      location: 'unsupported-market',
      language_code: '',
      current_rank: null,
      delta: null,
      best_rank: null,
      history: [],
    });
    expect(cells[2].textContent).toBe('unsupported-market · —');
    expect(cells[3].textContent).toBe('rankTrackingUi.notChecked');
    expect(cells[3].querySelector('span')!.className).toContain('bg-slate-800');
    expect(cells[4].textContent).toBe('—');
    expect(cells[5].textContent).toBe('—');
    expect(cells[6].textContent).toBe(i18n.t('componentUi.noTimeSeries'));
    fireEvent.click(screen.getByTitle('rankTrackingUi.removeTracking'));
    expect(onRemove).toHaveBeenCalledWith('rank-1');
  });

  it('renders the top-ten and outside-top-100 boundaries with negative and zero deltas', () => {
    const middle = show({ current_rank: 5, delta: -2, best_rank: 4, history: [{ date: 'x', rank: 5 }] });
    expect(middle.cells[3].querySelector('span')!.className).toContain('bg-emerald-500/10');
    expect(middle.cells[4].textContent).toContain('-2');
    expect(middle.cells[4].querySelector('span')!.className).toContain('text-rose-400');

    const outside = show({ current_rank: 101, delta: 0, best_rank: 101 });
    expect(outside.cells[3].textContent).toBe('rankTrackingUi.outsideTop100');
    expect(outside.cells[4].textContent).toContain('0');
    expect(outside.cells[4].querySelector('span')!.className).toContain('text-slate-400');
  });
});
