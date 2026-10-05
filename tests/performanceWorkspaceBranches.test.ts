import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { usePerformanceWorkspace } from '@/components/Performance/usePerformanceWorkspace';
import { psiFixture, cruxFixture } from './fixtures/pagespeedWorkspaceContracts';
import { readPageSpeedSnapshots } from '@/services/pagespeedHistory';
import { storageKey } from '@/components/Performance/performanceSession';

const runPsi = vi.fn(); const runCrux = vi.fn();
const setup = (project: string | null = 'perf-p', url = 'https://example.com/', current: () => string | null = () => project) =>
  renderHook((p: { id: string | null }) => usePerformanceWorkspace(p.id, url, i18n.t.bind(i18n) as never, { runPsi, runCrux, activeProjectId: current }), { initialProps: { id: project } });
const ui = (k: string) => i18n.t(`pageSpeedUi.${k}`);

describe('usePerformanceWorkspace', () => {
  beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); runPsi.mockReset().mockResolvedValue(psiFixture); runCrux.mockReset().mockResolvedValue(cruxFixture); });

  it('requires a url before running either test', async () => {
    const { result } = setup();
    act(() => result.current.updateSession({ url: '   ' }));
    await act(() => result.current.runPsi());
    await act(() => result.current.runCrux());
    expect(result.current.psiError).toBe(ui('urlRequired'));
    expect(result.current.cruxError).toBe(ui('urlRequired'));
    expect(runPsi).not.toHaveBeenCalled();
    expect(runCrux).not.toHaveBeenCalled();
  });

  it('stores results, records a history snapshot and persists the session', async () => {
    const { result } = setup();
    await act(() => result.current.runPsi());
    await act(() => result.current.runCrux());
    expect(result.current.session.pageSpeed?.source).toBe(psiFixture.source);
    expect(result.current.session.crux?.source).toBe(cruxFixture.source);
    expect(result.current.isRunningPsi).toBe(false);
    expect(result.current.history).toHaveLength(2);
    expect(readPageSpeedSnapshots('perf-p')).toHaveLength(2);
    expect(JSON.parse(localStorage.getItem(storageKey('perf-p')) as string).url).toBe('https://example.com/');
  });

  it('works without a project: no persistence and no snapshot', async () => {
    const { result } = setup(null);
    await act(() => result.current.runPsi());
    expect(result.current.session.pageSpeed).toBeTruthy();
    expect(result.current.history).toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it('shows Error messages, a generic message for non-Error, and rejects invalid reports', async () => {
    const { result } = setup();
    runPsi.mockRejectedValueOnce(new Error('quota'));
    await act(() => result.current.runPsi());
    expect(result.current.psiError).toBe('quota');
    runPsi.mockRejectedValueOnce('strange');
    await act(() => result.current.runPsi());
    expect(result.current.psiError).toBe(ui('psiError'));
    runPsi.mockResolvedValueOnce({ bogus: true });
    await act(() => result.current.runPsi());
    expect(result.current.psiError).toBe(ui('psiError'));
    runCrux.mockResolvedValueOnce({ bogus: true });
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBe(ui('cruxError'));
  });

  it('maps CrUX failures to specific messages', async () => {
    const { result } = setup();
    runCrux.mockRejectedValueOnce(new Error('CRUX_NOT_ENOUGH_DATA: none'));
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBe(i18n.t('pageSpeedUi.cruxNotEnoughData', 'Not enough real user data is available for this URL or origin.'));
    runCrux.mockRejectedValueOnce(new Error('network down'));
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBe('network down');
    runCrux.mockRejectedValueOnce(new Error(''));
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBe(ui('cruxError'));
    runCrux.mockRejectedValueOnce('plain');
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBe('plain');
    expect(result.current.isRunningCrux).toBe(false);
  });

  it('drops results when the active project changed while the request ran', async () => {
    let active = 'perf-p';
    let resolve: (v: unknown) => void = () => undefined;
    runPsi.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { result } = setup('perf-p', 'https://example.com/', () => active);
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.runPsi(); });
    expect(result.current.isRunningPsi).toBe(true);
    active = 'else';
    await act(async () => { resolve(psiFixture); await pending; });
    expect(result.current.session.pageSpeed).toBeNull();
    expect(result.current.history).toEqual([]);
    runPsi.mockRejectedValueOnce(new Error('late'));
    await act(() => result.current.runPsi());
    expect(result.current.psiError).toBeNull();
    runCrux.mockResolvedValueOnce(cruxFixture);
    await act(() => result.current.runCrux());
    expect(result.current.session.crux).toBeNull();
    runCrux.mockRejectedValueOnce(new Error('late'));
    await act(() => result.current.runCrux());
    expect(result.current.cruxError).toBeNull();
  });

  it('cancels an in-flight run when the session inputs change', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    runPsi.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const { result } = setup();
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.runPsi(); });
    act(() => result.current.updateSession({ strategy: 'desktop' }));
    expect(result.current.isRunningPsi).toBe(false);
    await act(async () => { resolve(psiFixture); await pending; });
    expect(result.current.session.pageSpeed).toBeNull();
    act(() => result.current.updateSession({ scope: 'origin' }));
    expect(result.current.session.scope).toBe('origin');
  });

  it('resets state when the project changes', async () => {
    const { result, rerender } = setup();
    await act(() => result.current.runPsi());
    expect(result.current.history).toHaveLength(1);
    rerender({ id: 'other-p' });
    await waitFor(() => expect(result.current.history).toEqual([]));
    expect(result.current.session.pageSpeed).toBeNull();
  });
});
