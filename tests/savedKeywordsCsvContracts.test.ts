import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { keyword, tools, resetKeywords } from './fixtures/savedKeywordsSession';

vi.mock('@/stores/toolsStore', async () => ({ useToolsStore: (await import('./fixtures/savedKeywordsSession')).tools }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/savedKeywordsSession')).project }));
vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/savedKeywordsSession')).audit }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));

let blob: Blob | undefined;
let download: { href: string; filename: string; connected: boolean } | undefined;
beforeEach(() => {
  resetKeywords(); blob = undefined; download = undefined;
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: vi.fn((value: Blob) => { blob = value; return 'blob:https://seomi.test/download'; }),
    revokeObjectURL: vi.fn(),
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    download = { href: this.href, filename: this.download, connected: this.isConnected };
  });
});
afterEach(async () => {
  vi.useRealTimers();
  await new Promise(resolve => setTimeout(resolve, 0));
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function downloadedText(): Promise<string> {
  if (!blob) return decodeURIComponent(download!.href.slice(download!.href.indexOf(',') + 1));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
    reader.readAsText(blob!);
  });
}

it('does not download an empty catalog', () => {
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.exportCSV());
  expect(download).toBeUndefined();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it('exports quotes, commas, multiline text, Unicode and hash characters without truncation', async () => {
  tools.setState({ savedKeywords: [keyword('a', { keyword: 'SEO "red", #café\nline', tags: ['a"b', 'local'] })] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.exportCSV());
  expect(new URL(download!.href).hash).toBe('');
  expect(await downloadedText()).toContain('"SEO ""red"", #café\nline","100","20","2","Commercial","a""b, local","2026-10-04"');
  expect(download!.filename).toBe(`seomi_saved_keywords_${new Date().toISOString().split('T')[0]}.csv`);
  expect(download!.connected).toBe(true);
  expect(document.querySelector('a[download]')).toBeNull();
});

it('neutralizes spreadsheet formulas in both keywords and tags', async () => {
  tools.setState({ savedKeywords: [keyword('a', { keyword: '=SUM(1,2)', tags: ['+tag'] })] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.exportCSV());
  expect(await downloadedText()).toContain('"\'=SUM(1,2)","100","20","2","Commercial","\'+tag"');
});

it('exports the whole saved catalog independently of visible filters', async () => {
  tools.setState({ savedKeywords: [keyword('a'), keyword('b')] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.setSearchFilter('Keyword a'));
  expect(result.current.filteredList).toHaveLength(1);
  act(() => result.current.exportCSV());
  const text = await downloadedText();
  expect(text).toContain('Keyword a'); expect(text).toContain('Keyword b');
  expect(text).toContain('savedKeywordsUi.keyword');
});

it('releases export resources when the browser rejects the download click', () => {
  vi.useFakeTimers();
  tools.setState({ savedKeywords: [keyword('a')] });
  vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => { throw new Error('download blocked'); });
  const { result } = renderHook(useSavedKeywordsSession);
  expect(() => result.current.exportCSV()).toThrow('download blocked');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  act(() => vi.runAllTimers());
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:https://seomi.test/download');
});

it('downloads actual UTF-8 CSV Blob data and defers URL cleanup until consumption starts', async () => {
  tools.setState({ savedKeywords: [keyword('a')] });
  const { result } = renderHook(useSavedKeywordsSession);
  act(() => result.current.exportCSV());
  expect(blob).toBeInstanceOf(Blob);
  expect(blob!.type).toBe('text/csv;charset=utf-8');
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  expect((await downloadedText()).split('\r\n')).toHaveLength(2);
  await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:https://seomi.test/download'));
});
