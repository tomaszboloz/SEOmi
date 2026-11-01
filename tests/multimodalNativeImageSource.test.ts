import { beforeEach, expect, it, vi } from 'vitest';
import { nativeImageSource } from '@/services/multimodal/nativeImageSource';
import { invokeTauriCommand } from '@/services/tauri/transport';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => false }));
const signal = () => new AbortController().signal;
beforeEach(() => vi.mocked(invokeTauriCommand).mockReset());

it('falls back to the CORS source outside the desktop app', async () => {
  const fallback = { id: 'f', fetch: vi.fn().mockResolvedValue({ ok: false, failure: 'blocked' }) };
  expect(await nativeImageSource(fallback, () => false).fetch('https://a.test/i.png', signal())).toEqual({ ok: false, failure: 'blocked' });
  expect(invokeTauriCommand).not.toHaveBeenCalled();
});

it('decodes the native download into a typed blob', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValue({ finalUrl: 'x', contentType: 'image/png', base64: 'YWJj' });
  const result = await nativeImageSource(undefined, () => true).fetch('https://a.test/i.png', signal());
  expect(invokeTauriCommand).toHaveBeenCalledWith('fetch_image_bytes', { url: 'https://a.test/i.png' });
  expect(result.ok && result.bytes.size).toBe(3);
  expect(result.ok && result.bytes.type).toBe('image/png');
});

it('maps the native error text to typed failures', async () => {
  const source = nativeImageSource(undefined, () => true);
  for (const [message, failure] of [['Not a raster image', 'not-image'], ['exceeds safety limit of 5', 'too-large'],
    ['Unsafe redirect blocked', 'unsupported-url'], ['Invalid image URL', 'unsupported-url'], ['HTTP 404', 'http-error'], ['timed out', 'blocked']] as const) {
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce(message);
    expect(await source.fetch('https://a.test/i.png', signal())).toEqual({ ok: false, failure });
  }
});

it('stops when cancelled before or during the download', async () => {
  const source = nativeImageSource(undefined, () => true);
  const done = new AbortController(); done.abort();
  await expect(source.fetch('https://a.test/i.png', done.signal)).rejects.toThrow();
  const late = new AbortController();
  vi.mocked(invokeTauriCommand).mockImplementationOnce(async () => { late.abort(); return { finalUrl: 'x', contentType: 'image/png', base64: 'YQ==' }; });
  await expect(source.fetch('https://a.test/i.png', late.signal)).rejects.toThrow();
  const failed = new AbortController();
  vi.mocked(invokeTauriCommand).mockImplementationOnce(async () => { failed.abort(); throw new Error('x'); });
  await expect(source.fetch('https://a.test/i.png', failed.signal)).rejects.toThrow();
});

it('hashImages defaults to the native source and canvas decoder', async () => {
  const { hashImages } = await import('@/services/multimodal/nearDuplicates');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const rows = await hashImages(['https://a.test/i.png'], { signal: signal() });
  expect(rows).toMatchObject([{ status: 'failed', failure: 'blocked' }]);
  vi.unstubAllGlobals();
  const decoded = await hashImages(['https://a.test/i.png'], { signal: signal(), source: { id: 's', fetch: async () => ({ ok: true, bytes: new Blob(['x']), contentType: 'image/png' }) } });
  expect(decoded).toMatchObject([{ status: 'failed', failure: 'decode-failed' }]);
});
