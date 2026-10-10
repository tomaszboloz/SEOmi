import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  normalize,
  pickerSort,
  pickerClasses,
  optionId,
  selectInputText,
  useDismiss,
  filterAndSortLocationOptions,
  filterAndSortLanguageOptions,
} from '@/components/DataForSEO/pickers/pickerPrimitives';
import type { DataForSeoMarket } from '@/services/dataforseo';

describe('pickerPrimitives direct assertions', () => {
  it('normalize strips accents, trims and lowercases text', () => {
    expect(normalize('  Zażółć Gęślą Jaźń  ')).toBe('zazołc gesla jazn');
    expect(normalize('CAFÉ')).toBe('cafe');
    expect(normalize('')).toBe('');
  });

  it('pickerSort ranks exact matches first, then prefix matches, then alphabetical', () => {
    const left = ['Poland', 'PL'];
    const right = ['Portugal', 'PT'];

    expect(pickerSort('pol', left, right)).toBeLessThan(0);
    expect(pickerSort('port', left, right)).toBeGreaterThan(0);
    expect(pickerSort('', left, right)).toBe(left[0].localeCompare(right[0]));
  });

  it('pickerClasses combines base and custom class names', () => {
    expect(pickerClasses()).toContain('relative min-w-48');
    expect(pickerClasses('custom-cls')).toBe('relative min-w-48 custom-cls');
  });

  it('optionId creates formatted option element IDs', () => {
    expect(optionId('menu-list', 3)).toBe('menu-list-option-3');
    expect(optionId('languages', 0)).toBe('languages-option-0');
  });

  it('selectInputText calls select on input element if provided', () => {
    const select = vi.fn();
    selectInputText({ select } as unknown as HTMLInputElement);
    expect(select).toHaveBeenCalledOnce();
    expect(() => selectInputText(null)).not.toThrow();
  });

  it('filterAndSortLocationOptions filters and ranks market options', () => {
    const markets = [
      { code: 'PL', label: 'Poland', locationCode: 2616 },
      { code: 'US', label: 'United States', locationCode: 2840 },
      { code: 'DE', label: 'Germany', locationCode: 2276 },
    ] as any as DataForSeoMarket[];

    const result = filterAndSortLocationOptions(markets, undefined, 'pol');
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('PL');

    const all = filterAndSortLocationOptions(markets, undefined, '');
    expect(all).toHaveLength(3);
  });

  it('filterAndSortLanguageOptions filters and ranks language options', () => {
    const langs = [
      { code: 'pl', label: 'Polish' },
      { code: 'en', label: 'English' },
      { code: 'de', label: 'German' },
    ];

    const result = filterAndSortLanguageOptions(langs, undefined, 'eng');
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('en');

    const emptyFilter = filterAndSortLanguageOptions(langs, undefined, '');
    expect(emptyFilter).toHaveLength(3);
  });

  it('useDismiss handles escape key and pointer events when open', () => {
    const close = vi.fn();
    const root = document.createElement('div');
    const rootRef = { current: root };

    const { unmount } = renderHook(() => useDismiss(true, close, rootRef));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(close).toHaveBeenCalledOnce();

    unmount();
  });
});
