import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import { getRenderWorkerStatus, isTauriEnvironment, startRenderWorker, stopRenderWorker } from '@/services/tauri';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({
  getRenderWorkerStatus: vi.fn(), isTauriEnvironment: vi.fn(),
  startRenderWorker: vi.fn(), stopRenderWorker: vi.fn(),
}));

describe('RenderWorkerPanel polling', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(getRenderWorkerStatus).mockReset().mockResolvedValue(false);
  });
  afterEach(() => vi.useRealTimers());

  it('polls the worker status every five seconds', async () => {
    vi.useFakeTimers();
    render(<RenderWorkerPanel />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(vi.mocked(getRenderWorkerStatus).mock.calls.length).toBe(3);
  });

  it('ignores status results that arrive after unmount', async () => {
    let resolve!: (v: boolean) => void;
    let reject!: (e: Error) => void;
    vi.mocked(getRenderWorkerStatus)
      .mockReturnValueOnce(new Promise<boolean>((r) => { resolve = r; }))
      .mockReturnValueOnce(new Promise<boolean>((_, r) => { reject = r; }));
    const first = render(<RenderWorkerPanel />);
    first.unmount();
    const second = render(<RenderWorkerPanel />);
    second.unmount();
    await act(async () => { resolve(true); reject(new Error('late')); });
    expect(getRenderWorkerStatus).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('render-worker-panel')).toBeNull();
  });

  it.each([true, false])('ignores a stale status probe after explicit stop: %s', async (status) => {
    let resolve!: (value: boolean) => void;
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(getRenderWorkerStatus).mockReset().mockResolvedValueOnce(false)
      .mockReturnValueOnce(new Promise<boolean>((done) => { resolve = done; }))
      .mockResolvedValue(false);
    vi.mocked(startRenderWorker).mockResolvedValue({ baseUrl: 'http://127.0.0.1', token: 'test-token',
      version: '1', expiresAt: new Date(Date.now() + 60_000).toISOString(), oneShot: true });
    vi.mocked(stopRenderWorker).mockResolvedValue(undefined);
    render(<RenderWorkerPanel />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.renderWorker.start') }));
    await screen.findByText('test-token');
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.renderWorker.stop') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(i18n.t('legacyUi.renderWorker.stopped')));
    await act(async () => resolve(status));
    expect(screen.getByRole('status').textContent).toBe(i18n.t('legacyUi.renderWorker.stopped'));
    expect(screen.queryByText('test-token')).toBeNull();
  });

  it('retains explicit stopped outcome when a status probe begun during stop resolves in the same React batch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T08:00:00Z'));
    let finishStop!: () => void;
    let finishProbe!: (active: boolean) => void;
    let count = 0;
    vi.mocked(getRenderWorkerStatus).mockImplementation(() => {
      count += 1;
      if (count === 1) return Promise.resolve(false);
      if (count === 2) return Promise.resolve(true);
      return new Promise((resolve) => { finishProbe = resolve; });
    });
    vi.mocked(startRenderWorker).mockResolvedValue({ baseUrl: 'http://127.0.0.1', token: 'audit-token',
      version: 'fixture', expiresAt: new Date(Date.now() + 60_000).toISOString(), oneShot: true });
    vi.mocked(stopRenderWorker).mockImplementation(() => new Promise((resolve) => { finishStop = resolve; }));
    render(<RenderWorkerPanel />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.renderWorker.start') })); await Promise.resolve(); });
    expect(screen.getByText('audit-token')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('legacyUi.renderWorker.stop') })); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(finishProbe).toBeTypeOf('function');
    await act(async () => { finishStop(); finishProbe(false); await Promise.resolve(); });
    expect(screen.getByRole('status').textContent).toBe(i18n.t('legacyUi.renderWorker.stopped'));
  });
});
