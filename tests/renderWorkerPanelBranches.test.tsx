import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderWorkerPanel } from '@/components/Settings/RenderWorkerPanel';
import { copyText } from '@/services/clipboard';
import {
  getRenderWorkerStatus,
  isTauriEnvironment,
  startRenderWorker,
  stopRenderWorker,
} from '@/services/tauri';
import i18n from '@/i18n';

vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/services/tauri', () => ({
  getRenderWorkerStatus: vi.fn(),
  isTauriEnvironment: vi.fn(),
  startRenderWorker: vi.fn(),
  stopRenderWorker: vi.fn(),
}));

const lease = (offsetMs = 60_000) => ({
  baseUrl: 'http://127.0.0.1:9347',
  token: 'tok-1',
  version: '1.2.3',
  expiresAt: new Date(Date.now() + offsetMs).toISOString(),
  oneShot: true,
});
const t = (k: string) => i18n.t(`legacyUi.renderWorker.${k}`);
const startBtn = () => screen.getByRole('button', { name: t('start') });

describe('RenderWorkerPanel branches', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(isTauriEnvironment).mockReturnValue(true);
    vi.mocked(getRenderWorkerStatus).mockReset().mockResolvedValue(false);
    vi.mocked(startRenderWorker).mockReset();
    vi.mocked(stopRenderWorker).mockReset();
    vi.mocked(copyText).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('shows desktop-required message when Tauri vanishes before start', async () => {
    let tauri = true;
    vi.mocked(isTauriEnvironment).mockImplementation(() => tauri);
    render(<RenderWorkerPanel />);
    tauri = false;
    fireEvent.click(startBtn());
    expect((await screen.findByRole('status')).textContent).toBe(t('desktopRequired'));
    expect(startRenderWorker).not.toHaveBeenCalled();
  });

  it('surfaces Error and non-Error start failures', async () => {
    vi.mocked(startRenderWorker).mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce('plain');
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('boom'));
    fireEvent.click(startBtn());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('plain'));
  });

  it('starts, shows lease details, then stops the worker', async () => {
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(true);
    vi.mocked(startRenderWorker).mockResolvedValue(lease());
    vi.mocked(stopRenderWorker).mockResolvedValue(undefined);
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    expect(await screen.findByText('tok-1')).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(t('started'));
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: t('stop') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t('stopped')));
    expect(screen.queryByText('tok-1')).toBeNull();
    expect(startBtn()).toBeTruthy();
  });

  it('reports stop failures with Error and string rejections', async () => {
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(true);
    vi.mocked(stopRenderWorker).mockRejectedValueOnce(new Error('nostop')).mockRejectedValueOnce('str');
    render(<RenderWorkerPanel />);
    expect(await screen.findByText(t('activeWithoutToken'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: t('stop') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('nostop'));
    fireEvent.click(screen.getByRole('button', { name: t('stop') }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('str'));
  });

  it('clears the lease when the backend reports the worker is inactive', async () => {
    vi.mocked(startRenderWorker).mockResolvedValue(lease());
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t('sessionExpired')));
    expect(screen.queryByText('tok-1')).toBeNull();
  });

  it('treats a failing status probe as inactive', async () => {
    vi.mocked(getRenderWorkerStatus).mockRejectedValue(new Error('down'));
    render(<RenderWorkerPanel />);
    await waitFor(() => expect(getRenderWorkerStatus).toHaveBeenCalled());
    expect(startBtn()).toBeTruthy();
  });

  it('expires an already-elapsed lease through the UI timer', async () => {
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(true);
    vi.mocked(startRenderWorker).mockResolvedValue(lease(-1_000));
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t('leaseExpired')));
    expect(screen.queryByText('tok-1')).toBeNull();
  });

  it('keeps a lease whose expiry cannot be parsed', async () => {
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(true);
    vi.mocked(startRenderWorker).mockResolvedValue({ ...lease(), expiresAt: 'garbage' });
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    expect(await screen.findByText('tok-1')).toBeTruthy();
    expect(screen.queryByText(t('leaseExpired'))).toBeNull();
  });

  it('copies the token and handles clipboard exceptions', async () => {
    vi.mocked(getRenderWorkerStatus).mockResolvedValue(true);
    vi.mocked(startRenderWorker).mockResolvedValue(lease());
    vi.mocked(copyText).mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('x'));
    render(<RenderWorkerPanel />);
    fireEvent.click(startBtn());
    const copy = await screen.findByRole('button', { name: t('copyToken') });
    fireEvent.click(copy);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t('tokenCopied')));
    fireEvent.click(copy);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(t('tokenCopyFailed')));
  });
});
