import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  captureRenderedArtifact, getRenderWorkerStatus, getSecureValue, invokeTauriCommand,
  isTauriEnvironment, openRenderedElementPreview, saveTextFile, setSecureValue,
  startRenderWorker, stopRenderWorker,
} from '@/services/tauri';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }));
beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  vi.mocked(invoke).mockReset().mockResolvedValue(undefined);
  vi.mocked(save).mockReset();
});
afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
});

it('forwards command arguments and returns the native result', async () => {
  vi.mocked(invoke).mockResolvedValue({ answer: 42 });
  expect(isTauriEnvironment()).toBe(true);
  await expect(invokeTauriCommand('example', { input: 1 })).resolves.toEqual({ answer: 42 });
  expect(invoke).toHaveBeenCalledWith('example', { input: 1 });
});
it.each([null, '', 'secret'])('hydrates native secure value %s', async (value) => {
  vi.mocked(invoke).mockResolvedValue(value);
  await expect(getSecureValue('key')).resolves.toBe(value || '');
  expect(invoke).toHaveBeenCalledWith('get_secret', { name: 'key' });
});
it('writes secrets through native transport', async () => {
  await expect(setSecureValue('key', 'value')).resolves.toBeUndefined();
  expect(invoke).toHaveBeenCalledWith('set_secret', { name: 'key', value: 'value' });
});
it('cancels the save without writing', async () => {
  vi.mocked(save).mockResolvedValue(null);
  await expect(saveTextFile({ defaultPath: 'a.json', contents: '{}', extension: 'json', filterName: 'JSON' })).resolves.toBe('cancelled');
  expect(invoke).not.toHaveBeenCalled();
});
it('writes the chosen file and preserves the dialog contract', async () => {
  vi.mocked(save).mockResolvedValue('/chosen/a.toml');
  await expect(saveTextFile({ defaultPath: 'a.toml', contents: 'x=1', extension: 'toml', filterName: 'TOML' })).resolves.toBe('saved');
  expect(save).toHaveBeenCalledWith({ defaultPath: 'a.toml', filters: [{ name: 'TOML', extensions: ['toml'] }] });
  expect(invoke).toHaveBeenCalledWith('write_mcp_config_file', { path: '/chosen/a.toml', contents: 'x=1' });
});
it('propagates native write errors', async () => {
  vi.mocked(save).mockResolvedValue('/chosen/file');
  vi.mocked(invoke).mockRejectedValue(new Error('write failed'));
  await expect(saveTextFile({ defaultPath: 'a.json', contents: '{}', extension: 'json', filterName: 'JSON' })).rejects.toThrow('write failed');
});
it.each([false, true])('preserves rendered capture optional arguments: %s', async (explicit) => {
  const result = { path: '/artifact' };
  vi.mocked(invoke).mockResolvedValue(result);
  await expect(captureRenderedArtifact({ url: 'https://example.com', allowSubdomains: true, kind: 'pdf',
    ...(explicit ? { scopePath: '/docs', waitForSelector: 'h1', waitDelayMs: 5, lazyScrollCycles: 2, runId: 'run' } : {}),
  })).resolves.toEqual(result);
  expect(invoke).toHaveBeenCalledWith('capture_rendered_artifact', {
    url: 'https://example.com', allowSubdomains: true, kind: 'pdf',
    scopePath: explicit ? '/docs' : null, waitForSelector: explicit ? 'h1' : null,
    waitDelayMs: explicit ? 5 : 0, lazyScrollCycles: explicit ? 2 : 0, runId: explicit ? 'run' : null,
  });
});
it.each([undefined, -1, 1.5, NaN, 0, 2])('validates preview DOM index %s', async (domIndex) => {
  await openRenderedElementPreview({ url: 'invalid', selector: 'a', needle: 'link', domIndex });
  expect(invoke).toHaveBeenCalledWith('open_rendered_element_preview', expect.objectContaining({
    url: 'invalid', selector: 'a', needle: 'link',
    domIndex: Number.isInteger(domIndex) && Number(domIndex) >= 0 ? domIndex : null,
    previewTitle: 'Preview · ',
  }));
});
it('returns worker lease, status and stop acknowledgement', async () => {
  const lease = { baseUrl: 'http://127.0.0.1', token: 'test', version: '1', expiresAt: 'soon', oneShot: true };
  vi.mocked(invoke).mockResolvedValueOnce(lease).mockResolvedValueOnce(true).mockResolvedValueOnce(undefined);
  await expect(startRenderWorker()).resolves.toEqual(lease);
  await expect(getRenderWorkerStatus()).resolves.toBe(true);
  await expect(stopRenderWorker()).resolves.toBeUndefined();
  expect(vi.mocked(invoke).mock.calls).toEqual([
    ['start_render_worker', undefined], ['render_worker_status', undefined], ['stop_render_worker', undefined],
  ]);
});
it('detects an absent browser global without throwing', () => {
  vi.stubGlobal('window', undefined);
  try { expect(isTauriEnvironment()).toBe(false); }
  finally { vi.unstubAllGlobals(); }
});
