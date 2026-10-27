import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from '@/services/clipboard';

describe('desktop clipboard adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the async clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('copy me')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('falls back to a temporary selectable textarea when the API is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    expect(await copyText('fallback text')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('returns false when document.execCommand is unavailable or throws', async () => {
    vi.stubGlobal('navigator', {});
    const original = document.execCommand;

    delete (document as unknown as { execCommand?: unknown }).execCommand;
    expect(await copyText('fail')).toBe(false);

    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => { throw new Error('exec fail'); }),
    });
    expect(await copyText('throw')).toBe(false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: original });
  });
});
