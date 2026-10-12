import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import {
  getRenderWorkerStatus,
  isTauriEnvironment, startRenderWorker, stopRenderWorker,
} from '@/services/tauri';
import i18n from '@/i18n';

vi.mock('@/services/tauri', () => ({
  getRenderWorkerStatus: vi.fn(),
  isTauriEnvironment: vi.fn(),
  startRenderWorker: vi.fn(),
  stopRenderWorker: vi.fn(),
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
