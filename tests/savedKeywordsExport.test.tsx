import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock('@/services/download', () => downloads);

import i18n from '@/i18n';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { useToolsStore } from '@/stores/toolsStore';

const keyword = (id: string, text: string, tags: string[] = []) => ({ id, keyword: text, search_volume: 100, difficulty: 30, cpc: 1.5, intent: 'informational', tags, addedAt: '2026-10-01T00:00:00.000Z' });
const exported = async () => {
  const view = renderHook(() => useSavedKeywordsSession());
  act(() => view.result.current.exportCSV());
  const [filename, blob] = downloads.downloadBlob.mock.calls[0] as [string, Blob];
  // jsdom's Blob has no text(); FileReader is the portable way to read it.
  const text = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob); });
  return { filename, text };
};

beforeEach(async () => { vi.clearAllMocks(); await i18n.changeLanguage('en'); useToolsStore.setState({ savedKeywords: [] } as never); });
afterEach(() => vi.restoreAllMocks());

describe('saved keywords CSV export', () => {
  it('does nothing when there are no saved keywords', () => {
    const view = renderHook(() => useSavedKeywordsSession());
    act(() => view.result.current.exportCSV());
    expect(downloads.downloadBlob).not.toHaveBeenCalled();
  });

  it('neutralizes spreadsheet formulas in keywords and tags', async () => {
    useToolsStore.setState({ savedKeywords: [keyword('1', '=HYPERLINK("http://evil.test","x")', ['@SUM(A1)']), keyword('2', '-2+3'), keyword('3', '+cmd|calc')] } as never);
    const { text } = await exported();
    const lines = text.split(/\r?\n/);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil.test"",""x"")"`);
    expect(lines[1]).toContain(`"'@SUM(A1)"`);
    expect(lines[2].startsWith(`"'-2+3"`)).toBe(true);
    expect(lines[3].startsWith(`"'+cmd|calc"`)).toBe(true);
  });

  it('keeps one record per keyword even with quotes, commas, hashes and newlines', async () => {
    useToolsStore.setState({ savedKeywords: [keyword('1', 'say "hi", #1\nnow', ['a,b', 'c'])] } as never);
    const { text, filename } = await exported();
    expect(filename).toMatch(/^seomi_saved_keywords_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(text).toContain('"say ""hi"", #1\nnow"');
    expect(text).toContain('"a,b, c"');
    expect(text.replace(/^\uFEFF/, '').split('\r\n')).toHaveLength(2);
  });
});
