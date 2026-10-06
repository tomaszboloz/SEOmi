import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SerpImportPanel } from '@/components/Keywords/embeddingClustering/SerpImportPanel';
import type { ImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import type { FreeSerpResult } from '@/services/freeSerp';
import { parseSerpJson } from '@/services/serpImport';

const fetchFreeSerp = vi.hoisted(() => vi.fn());
vi.mock('@/services/freeSerp', () => ({ fetchFreeSerp }));

const source = {
  kind: 'bing-rss' as const, provider: 'Bing', sourceUrl: 'https://www.bing.com/search?cc=PL&format=rss&q=seo&setlang=pl',
  countryCode: 'PL', locationCode: null, languageCode: 'pl', capturedAt: null,
  retrievedAt: '2026-10-06T12:00:00.000Z', availability: 'partial' as const,
  reason: 'Bing RSS is partial free-engine coverage, not Google SERP equivalent',
};
const result: FreeSerpResult = {
  feed: 'bing-serp', fetchedAt: source.retrievedAt, sourceUrl: source.sourceUrl, snapshot: null,
  source, records: [{ keyword: 'seo', rank: 1, url: 'https://example.test/' }], rejected: [], duplicateCount: 0,
  excludedOutsideTop10: 0, snapshots: [{ keyword: 'seo', rows: [{ rank: 1, url: 'https://example.test/' }], urls: ['https://example.test/'], source }],
};
const props = (imported: ImportedSerp | null = null) => ({ projectId: 'project-1', imported, error: null, onImport: vi.fn(), onClear: vi.fn() });
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const okOutcome = () => ({ status: 'ok' as const, response: { status: 'ok' as const, sourceUrl: source.sourceUrl, fetchedAt: source.retrievedAt, body: '<rss/>', httpStatus: 200, error: null }, result });

beforeEach(async () => { await i18n.changeLanguage('en'); fetchFreeSerp.mockReset(); });

describe('free Bing SERP UI', () => {
  it('fetches the selected query and persists explicit partial Bing metadata', async () => {
    fetchFreeSerp.mockResolvedValue({ status: 'ok', response: { status: 'ok', sourceUrl: source.sourceUrl, fetchedAt: source.retrievedAt, body: '<rss/>', httpStatus: 200, error: null }, result });
    const view = props(); render(<SerpImportPanel {...view} />);
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'seo' } });
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'pl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Bing RSS' }));
    await waitFor(() => expect(view.onImport).toHaveBeenCalledOnce());
    expect(fetchFreeSerp).toHaveBeenCalledWith({ feed: 'bing-serp', geo: 'PL', keyword: 'seo', language: 'pl' });
    const [payload, format] = view.onImport.mock.calls[0];
    expect(format).toBe('json');
    expect(JSON.parse(payload).metadata).toMatchObject({ kind: 'bing-rss', availability: 'partial', provider: 'Bing' });
  });

  it('shows blocked feed evidence without importing an unavailable body', async () => {
    fetchFreeSerp.mockResolvedValue({ status: 'blocked', response: { status: 'blocked', sourceUrl: source.sourceUrl, fetchedAt: source.retrievedAt, body: null, httpStatus: 429, error: 'HTTP 429' }, result: null });
    const view = props(); render(<SerpImportPanel {...view} />);
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'seo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Bing RSS' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Bing RSS was blocked');
    expect(view.onImport).not.toHaveBeenCalled();
  });

  it('shows transport failures without inventing a partial snapshot', async () => {
    fetchFreeSerp.mockRejectedValue(new Error('desktop transport unavailable'));
    const view = props(); render(<SerpImportPanel {...view} />);
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'seo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Bing RSS' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Bing RSS request failed: desktop transport unavailable');
    expect(view.onImport).not.toHaveBeenCalled();
  });

  it('labels persisted Bing evidence as semantic-only until complete SERP data exists', () => {
    const imported = { payload: '{}', format: 'json' as const, importedAt: source.retrievedAt, result };
    render(<SerpImportPanel {...props(imported)} />);
    expect(screen.getByRole('status').textContent).toContain('semantic-only');
    expect(screen.getByText(`Retrieved: ${source.retrievedAt}`).textContent).toBe(`Retrieved: ${source.retrievedAt}`);
    expect(screen.getByText(/^Captured: Unknown/).textContent).toContain('Captured: Unknown');
  });

  it('revalidates persisted feed payloads as Bing partial evidence', () => {
    const parsed = parseSerpJson(JSON.stringify({ metadata: { ...source, kind: source.kind }, records: result.records }));
    expect(parsed.source.kind).toBe('bing-rss');
    expect(parsed.source.availability).toBe('partial');
    expect(parsed.snapshots[0].source.provider).toBe('Bing');
  });

  it('ignores a late response after query changes and releases the busy state', async () => {
    const pending = deferred<ReturnType<typeof okOutcome>>(); fetchFreeSerp.mockReturnValue(pending.promise);
    const view = props(); render(<SerpImportPanel {...view} />);
    const query = screen.getByLabelText('Query'); const button = screen.getByRole('button', { name: 'Fetch Bing RSS' });
    fireEvent.change(query, { target: { value: 'old query' } }); fireEvent.click(button);
    fireEvent.change(query, { target: { value: 'new query' } });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    pending.resolve(okOutcome()); await waitFor(() => expect(view.onImport).not.toHaveBeenCalled());
  });

  it('cancels pending transport on clear and on a manual import', async () => {
    const pending = deferred<ReturnType<typeof okOutcome>>(); fetchFreeSerp.mockReturnValue(pending.promise);
    const view = props({ payload: '{}', format: 'json', importedAt: source.retrievedAt, result }); render(<SerpImportPanel {...view} />);
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'seo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fetch Bing RSS' })); fireEvent.click(screen.getByRole('button', { name: 'Remove import' }));
    expect(view.onClear).toHaveBeenCalledOnce();
    pending.reject(new Error('late failure')); await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'seo again' } }); fireEvent.click(screen.getByRole('button', { name: 'Fetch Bing RSS' }));
    fireEvent.change(screen.getByLabelText('Observed SERP data'), { target: { value: 'keyword,rank,url\nmanual,1,https://manual.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Import SERP' })); pending.resolve(okOutcome());
    await waitFor(() => expect(view.onImport).toHaveBeenCalledOnce());
    expect(view.onImport.mock.calls[0][0]).toContain('manual,1,https://manual.test');
  });
});
