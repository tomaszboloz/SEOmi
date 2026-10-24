import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invokeTauriCommand, isTauriEnvironment } from '@/services/tauri/transport';
import { fetchSource, SOURCE_TIMEOUT_MS } from '@/services/offPage/sourceTransport';
import { deferredSource, sourceAudit, sourceEvidence } from './fixtures/offPageSources';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: vi.fn() }));
vi.mock('@/services/offPage/sourcePacer', () => ({ waitForSourceSlot: async () => {} }));
beforeEach(() => {
  vi.mocked(isTauriEnvironment).mockReturnValue(true);
  vi.mocked(invokeTauriCommand).mockReset();
});
afterEach(() => vi.useRealTimers());
describe('source native transport', () => {
  it('reuses guarded inspect_url, bounds text, timestamps it and retains no HTML or audit', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue({ ...sourceAudit('a'.repeat(25_000)), html: '<html>private</html>' });
    const source = await fetchSource(sourceEvidence(), new AbortController().signal);
    expect(source.text).toHaveLength(20_000);
    expect(source.availability).toBe('ok');
    expect(Number.isFinite(Date.parse(source.fetchedAt!))).toBe(true);
    expect(source).not.toHaveProperty('html');
    expect(invokeTauriCommand).toHaveBeenCalledWith('inspect_url', expect.objectContaining({
      url: source.sourceUrl, timeoutSecs: 15, maxRedirects: 5, verifySsl: true, requestId: expect.stringMatching(/^offpage-/u),
    }));
  });
  it.each([[200, ''], [500, 'not evidence'], [302, 'redirect'], [204, undefined]])('handles empty/error response %s', async (status, text) => {
    vi.mocked(invokeTauriCommand).mockResolvedValue({ ...sourceAudit(text, status), content_stats: { body_text: text } });
    expect(await fetchSource(sourceEvidence(), new AbortController().signal)).toMatchObject({ availability: 'unavailable', text: '' });
  });
  it.each([
    ['Network request failed: Response size exceeds safety limit of 26214400 bytes', 'too-large'],
    ['body too large', 'too-large'], ['URL validation failed', 'blocked'],
    ['DNS resolved to a private or reserved address; request blocked', 'blocked'], ['DNS lookup failed', 'unavailable'],
  ])('records failure %s without exposing an error body', async (error, availability) => {
    vi.mocked(invokeTauriCommand).mockRejectedValue(error);
    expect(await fetchSource(sourceEvidence(), new AbortController().signal)).toMatchObject({ availability, text: '', vector: null });
  });
  it('does not use browser fallbacks or a new HTTP client', async () => {
    vi.mocked(isTauriEnvironment).mockReturnValue(false);
    expect((await fetchSource(sourceEvidence(), new AbortController().signal)).availability).toBe('unavailable');
    expect(invokeTauriCommand).not.toHaveBeenCalled();
  });
  it('cancels the exact native request on deadline even if the adapter ignores abort', async () => {
    vi.useFakeTimers();
    vi.mocked(invokeTauriCommand).mockImplementation(async (command) => command === 'inspect_url' ? new Promise(() => {}) : true);
    const result = fetchSource(sourceEvidence(), new AbortController().signal);
    await vi.advanceTimersByTimeAsync(SOURCE_TIMEOUT_MS);
    expect((await result).availability).toBe('unavailable');
    const args = vi.mocked(invokeTauriCommand).mock.calls[0][1];
    expect(invokeTauriCommand).toHaveBeenCalledWith('cancel_inspect_url', { requestId: args?.requestId });
  });
  it('rejects cancellation and never returns a late result; cancel command failures are isolated', async () => {
    const native = deferredSource<ReturnType<typeof sourceAudit>>();
    vi.mocked(invokeTauriCommand).mockImplementation((command) => command === 'inspect_url' ? native.promise as never : Promise.reject('gone'));
    const controller = new AbortController();
    const result = fetchSource(sourceEvidence(), controller.signal);
    const rejected = expect(result).rejects.toThrow();
    await Promise.resolve();
    controller.abort();
    native.resolve(sourceAudit());
    await rejected;
    await expect(fetchSource(sourceEvidence(), controller.signal)).rejects.toThrow();
  });
});
