import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageSpeedHistory } from '@/components/Performance/pagespeed/PageSpeedHistory';
import { clearPageSpeedSnapshots, pageSpeedHistoryCsv } from '@/services/pagespeedHistory';
import { historySnapshot } from './fixtures/pageSpeedHistory';
import i18n from '@/i18n';

const { download, clear } = vi.hoisted(() => ({ download: vi.fn(), clear: vi.fn() }));
vi.mock('@/services/export', () => ({ downloadText: download }));
vi.mock('@/services/pagespeedHistory', async (orig) => ({
  ...(await orig<typeof import('@/services/pagespeedHistory')>()),
  clearPageSpeedSnapshots: clear,
}));

const latest = historySnapshot({ id: 'new', capturedAt: '2026-10-02T00:00:00Z' });
const older = historySnapshot({ id: 'old', crux: null, capturedAt: '2026-09-01T00:00:00Z' });
const labOnly = historySnapshot({ id: 'lab', pageSpeed: null, capturedAt: '2026-08-01T00:00:00Z' });
const base = {
  history: [latest, older, labOnly], setHistory: vi.fn(), compareId: '', setCompareId: vi.fn(),
  activeProjectId: 'p1', latestSnapshot: latest, chronologicalHistory: [labOnly, older, latest],
  comparison: null,
};

describe('PageSpeedHistory', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    download.mockReset(); clear.mockReset();
    base.setHistory = vi.fn(); base.setCompareId = vi.fn();
  });

  it('shows an empty state and disables actions without history', () => {
    render(<PageSpeedHistory {...base} history={[]} latestSnapshot={null} chronologicalHistory={[]} />);
    expect(screen.getByText(i18n.t('pageSpeedUi.noSnapshots'))).toBeTruthy();
    expect((screen.getByText(i18n.t('pageSpeedUi.exportCsv')) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText(i18n.t('pageSpeedUi.clearHistory')).closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('exports CSV under a project-specific filename', () => {
    render(<PageSpeedHistory {...base} />);
    fireEvent.click(screen.getByText(i18n.t('pageSpeedUi.exportCsv')));
    expect(download).toHaveBeenCalledWith(
      'seomi-pagespeed-history-p1.csv', pageSpeedHistoryCsv(base.history), 'text/csv');
  });

  it('falls back to a generic filename when no project is active', () => {
    render(<PageSpeedHistory {...base} activeProjectId={null} />);
    fireEvent.click(screen.getByText(i18n.t('pageSpeedUi.exportCsv')));
    expect(download.mock.calls[0][0]).toBe('seomi-pagespeed-history-project.csv');
  });

  it('clears history only after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PageSpeedHistory {...base} />);
    const button = screen.getByText(i18n.t('pageSpeedUi.clearHistory')).closest('button')!;
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledWith(i18n.t('pageSpeedUi.clearConfirm'));
    expect(clearPageSpeedSnapshots).not.toHaveBeenCalled();
    expect(base.setHistory).not.toHaveBeenCalled();
    fireEvent.click(button);
    expect(clear).toHaveBeenCalledWith('p1');
    expect(base.setHistory).toHaveBeenCalledWith([]);
    expect(base.setCompareId).toHaveBeenCalledWith('');
    confirm.mockRestore();
  });

  it('offers every snapshot except the latest as baseline and reports selection', () => {
    render(<PageSpeedHistory {...base} />);
    const select = screen.getByLabelText(i18n.t('pageSpeedUi.baselineAria')) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'old', 'lab']);
    fireEvent.change(select, { target: { value: 'old' } });
    expect(base.setCompareId).toHaveBeenCalledWith('old');
  });

  it('lists the history table rows with a dash when lab data is missing', () => {
    render(<PageSpeedHistory {...base} />);
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(new RegExp(`${i18n.t('pageSpeedUi.latest')}:`))).toBeTruthy();
  });

  it('omits the latest label when there is no latest snapshot', () => {
    render(<PageSpeedHistory {...base} latestSnapshot={null} />);
    expect(screen.queryByText(new RegExp(`${i18n.t('pageSpeedUi.latest')}:`))).toBeNull();
  });

  it('renders the comparison panel when a comparison is provided', () => {
    const comparison = {
      baseline: { capturedAt: older.capturedAt }, current: { capturedAt: latest.capturedAt },
      categoryDeltas: [], metricDeltas: [], cruxDeltas: [],
    };
    render(<PageSpeedHistory {...base} comparison={comparison} />);
    expect(screen.getByText(i18n.t('pageSpeedUi.comparisonTitle'))).toBeTruthy();
  });
});
