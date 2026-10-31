import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AioCalibrationLabels } from '@/components/Domain/crawlResults/aio/AioCalibrationLabels';
import { CrawlAioTab } from '@/components/Domain/crawlResults/aio/CrawlAioTab';
import i18n from '@/i18n';
import type { AioSnapshot } from '@/services/aioReadiness/history';
import { aioHistoryKey, buildAioReport } from '@/services/aioReadiness';
import { AIO_LABELLING_HEADER } from '@/services/monitoringAlerts';
import { GOOD_PAGE } from './aioFixtures';

const copyText = vi.hoisted(() => vi.fn<(text: string) => Promise<boolean>>());
vi.mock('@/services/clipboard', () => ({ copyText }));

const snap = (runId: string, at: string, score: number): AioSnapshot =>
  ({ runId, at, score, selfContainment: 0, spoDensity: 0, extractability: 0, scored: 1, weakPassages: 0 });
const history = [snap('r1', '2026-01-01', 80), snap('r2', '2026-02-01', 60)];
const rows = (count: number, label: string) => Array.from({ length: count }, (_, i) => `"${label}${i}","80","${label === 'alert' ? 60 : 78}","","","${label}"`);

beforeEach(async () => { copyText.mockReset(); localStorage.clear(); await i18n.changeLanguage('en'); });

describe('AioCalibrationLabels (#108)', () => {
  it('copies the labelling sheet with an empty label column and reports copy failure', async () => {
    copyText.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<AioCalibrationLabels history={history} />);
    const button = screen.getByRole('button', { name: /Copy labelling sheet \(1 pairs\)/ });
    fireEvent.click(button);
    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(copyText.mock.calls[0][0]).toBe(`${AIO_LABELLING_HEADER}\n"r1>r2","80","60","20","2026-02-01",""`);
    fireEvent.click(button);
    expect(await screen.findByText('Copy failed')).toBeTruthy();
  });

  it('disables actions without pairs or pasted text', () => {
    render(<AioCalibrationLabels history={[history[0]]} />);
    expect((screen.getByRole('button', { name: /Copy labelling sheet/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Check labels' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('reports too few labels, invalid lines and single-class sheets without suggesting a threshold', () => {
    render(<AioCalibrationLabels history={history} />);
    const input = screen.getByLabelText('Labelled sheet (CSV)');
    fireEvent.change(input, { target: { value: [...rows(2, 'alert'), '"x","bad","1","","","alert"', '"y","1","2","","",""'].join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: 'Check labels' }));
    const result = screen.getByTestId('aio-calibration-result');
    expect(result.textContent).toContain('Labelled pairs: 2 (alert 2, no alert 0); unlabelled: 1.');
    expect(result.textContent).toContain('lines 3');
    expect(result.textContent).toContain('at least 20');
    fireEvent.change(input, { target: { value: rows(25, 'alert').join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: 'Check labels' }));
    expect(screen.getByTestId('aio-calibration-result').textContent).toContain('All labels have the same value');
  });

  it('suggests a threshold as advice once both classes are labelled', () => {
    render(<AioCalibrationLabels history={history} />);
    fireEvent.change(screen.getByLabelText('Labelled sheet (CSV)'), { target: { value: [...rows(12, 'alert'), ...rows(12, 'no-alert')].join('\n') } });
    fireEvent.click(screen.getByRole('button', { name: 'Check labels' }));
    expect(screen.getByTestId('aio-calibration-result').textContent).toMatch(/drop threshold of [\d.]+ points\. This is advice only/);
  });

  it('is mounted in the AIO tab only when the project has at least two snapshots', async () => {
    const { unmount } = render(<CrawlAioTab pages={[GOOD_PAGE]} projectId="proj-1" />);
    expect(screen.queryByTestId('aio-calibration')).toBeNull();
    unmount();
    const { id, algorithmVersion, configHash, language, market } = buildAioReport([GOOD_PAGE]).profile;
    localStorage.setItem(aioHistoryKey('proj-1'), JSON.stringify(history.map((item) => ({ ...item, profile: { id, algorithmVersion, configHash, language, market } }))));
    render(<CrawlAioTab pages={[GOOD_PAGE]} projectId="proj-1" />);
    await waitFor(() => expect(screen.getByTestId('aio-calibration')).toBeTruthy());
  });
});
