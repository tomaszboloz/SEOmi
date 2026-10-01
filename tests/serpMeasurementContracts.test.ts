import { afterEach, expect, it, vi } from 'vitest';
import { measureSerpText, truncateSerpText, truncateSerpSnippet } from '@/services/serpPreview/measurement';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const measure = (text: string) => Array.from(text).length * 10;

it('uses deterministic glyph widths when document or navigator is unavailable', () => {
  vi.stubGlobal('document', undefined);
  expect(measureSerpText(" iMZ😀a", 100)).toBeCloseTo(353);
  vi.unstubAllGlobals(); vi.stubGlobal('navigator', undefined);
  expect(measureSerpText('a', 10)).toBeCloseTo(5.2);
});
it.each(['null', 'throws'])('falls back when the browser canvas %s', mode => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Browser');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    if (mode === 'throws') throw new Error('restricted canvas');
    return null;
  });
  expect(measureSerpText('MW', 10)).toBeCloseTo(17.6);
});
it('uses the measured browser width and sets its font before measurement', () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Browser');
  const context = { font: '', measureText: vi.fn(() => ({ width: 123 })) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
  expect(measureSerpText('observed', 14)).toBe(123);
  expect(context.font).toBe('14px Arial, sans-serif');
  expect(context.measureText).toHaveBeenCalledWith('observed');
});
it('normalizes whitespace, fits exact boundaries and does not split Unicode characters', () => {
  expect(truncateSerpText('  a  b\n ', 30, 10, measure)).toBe('a b');
  expect(truncateSerpText('😀😀😀', 20, 10, measure)).toBe('😀…');
  expect(truncateSerpText('long', 5, 10, measure)).toBe('');
  expect(truncateSerpText('long', 10, 10, measure)).toBe('…');
  expect(truncateSerpText('  ', 100, 10, measure)).toBe('');
  expect(truncateSerpText('a', 100, 10)).toBe('a');
});
it('bounds snippets by measured lines, including empty and oversized single words', () => {
  expect(truncateSerpSnippet('  ', 20, 10, 2, measure)).toBe('');
  expect(truncateSerpSnippet('alpha beta', 50, 10, 0, measure)).toBe('');
  expect(truncateSerpSnippet('oversized', 30, 10, 2, measure)).toBe('ov…');
  expect(truncateSerpSnippet('oversized', 5, 10, 2, measure)).toBe('');
  expect(truncateSerpSnippet('alpha beta gamma', 50, 10, 1, measure)).toBe('alph…');
  expect(truncateSerpSnippet('a', 100, 10)).toBe('a');
});
