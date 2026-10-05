import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import {
  getRenderWorkerStatus,
  isTauriEnvironment,
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
