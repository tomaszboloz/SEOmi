import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), add: vi.fn(), importSuggestions: vi.fn(), onSaveWithoutProvenance: null as null | ((kw: string) => void) }));
vi.mock('@/services/freeSuggestions', async () => {
  const actual = await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions');
  return {
    ...actual,
    fetchFreeSuggestions: mocks.fetch,
    importSuggestions: (...args: Parameters<typeof actual.importSuggestions>) => mocks.importSuggestions(...args),
  };
});
vi.mock('@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession', async () => {
  const actual = await vi.importActual<typeof import('@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession')>('@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession');
  return {
    ...actual,
    useFreeSuggestionsSession: (opts: Parameters<typeof actual.useFreeSuggestionsSession>[0]) => {
      mocks.onSaveWithoutProvenance = (kw: string) => opts.onSave(kw);
      return actual.useFreeSuggestionsSession(opts);
    },
  };
});

const defaultSug = {
  feed: 'google-suggestions' as const, query: 'seo', suggestions: ['seo audit'], fetchedAt: '2026-10-06T10:00:00Z',
  sourceUrl: 'https://suggestqueries.google.com/complete/search?q=seo',
  source: { kind: 'google-suggest-unofficial' as const, provider: 'Google Suggest' as const, sourceUrl: 'https://suggestqueries.google.com/complete/search?q=seo', requestedGeo: 'PL', requestedLanguage: 'pl', availability: 'best-effort' as const, reason: 'best effort' },
};

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions');
  mocks.importSuggestions.mockImplementation((...args: Parameters<typeof actual.importSuggestions>) => actual.importSuggestions(...args));
  await i18n.changeLanguage('en');
  mocks.fetch.mockReset(); mocks.add.mockReset();
  useProjectStore.setState({ activeProjectId: 'p1' });
  useToolsStore.setState({ savedKeywords: [], crawlRuns: [], addSavedKeyword: mocks.add } as never);
});

describe('FreeSuggestionsPanel branches', () => {
  it('handles query typing, byte limits, empty input, and loading state', async () => {
    let resolveFetch: (val: unknown) => void = () => {};
    mocks.fetch.mockImplementation(() => new Promise((resolve) => { resolveFetch = resolve; }));
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const input = screen.getByRole('textbox', { name: /Query/i });
    fireEvent.change(input, { target: { value: 'a'.repeat(501) } });
    expect(screen.getByText('501/500 bytes UTF-8').className).toContain('text-rose-300');
    expect((screen.getByRole('button', { name: /Fetch suggestions/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: '   ' } });
    expect((screen.getByRole('button', { name: /Fetch suggestions/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'seo guide' } });
    const fetchBtn = screen.getByRole('button', { name: /Fetch suggestions/i });
    fireEvent.click(fetchBtn);
    expect((fetchBtn as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      resolveFetch({ status: 'ok', response: { status: 'ok', sourceUrl: 'u', fetchedAt: 't', body: '[]', httpStatus: 200, error: null }, result: { ...defaultSug, suggestions: [] } });
    });
    await screen.findByText('No suggestions returned.');
  });

  it('renders generic error, handles already saved suggestions, and saves without provenance', async () => {
    mocks.fetch.mockResolvedValueOnce({ status: 'error', result: null, response: { error: 'Network timeout' } });
    const { rerender } = render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch suggestions/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Network timeout'));

    useToolsStore.setState({ savedKeywords: [{ keyword: 'seo audit' }] as never });
    mocks.fetch.mockResolvedValueOnce({ status: 'ok', response: { status: 'ok', sourceUrl: 'u', fetchedAt: 't', body: '[]', httpStatus: 200, error: null }, result: { ...defaultSug, suggestions: ['seo audit', 'seo tips'] } });
    rerender(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch suggestions/i }));
    await screen.findByText('seo tips');
    expect(screen.getByRole('button', { name: /Saved/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo tips', tags: ['Google Suggest'] }));

    mocks.onSaveWithoutProvenance?.('unlinked kw');
    expect(mocks.add).toHaveBeenCalledWith(expect.not.objectContaining({ provenance: expect.anything() }));
  });

  it('handles csv format, already saved imported items, and missing project', async () => {
    useToolsStore.setState({ savedKeywords: [{ keyword: 'seo tips' }] as never });
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const importBtn = screen.getByRole('button', { name: /^Import$/i });
    importBtn.removeAttribute('disabled');
    fireEvent.click(importBtn);

    fireEvent.change(screen.getByRole('combobox', { name: /Import format/i }), { target: { value: 'csv' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Source URL/i }), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Suggestions payload/i }), { target: { value: 'seo tips, seo guide' } });
    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));
    await screen.findByText('seo guide');
    const saveButtons = screen.getAllByRole('button', { name: /^Save$/i });
    expect((saveButtons[0] as HTMLButtonElement).disabled).toBe(true);
    saveButtons[0].removeAttribute('disabled');
    fireEvent.click(saveButtons[0]);
    expect(mocks.add).not.toHaveBeenCalled();

    fireEvent.click(saveButtons[1]);
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo guide', tags: ['User import'] }));

    useProjectStore.setState({ activeProjectId: null });
    fireEvent.change(screen.getByRole('textbox', { name: /Suggestions payload/i }), { target: { value: 'seo tips' } });
    importBtn.removeAttribute('disabled');
    fireEvent.click(importBtn);
  });

  it('handles JSON import errors and non-Error exception fallback', async () => {
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const textarea = screen.getByRole('textbox', { name: /Suggestions payload/i });
    fireEvent.change(textarea, { target: { value: 'not-a-valid-json' } });
    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Imported suggestions JSON is invalid'));

    mocks.importSuggestions.mockImplementationOnce(() => { throw 'String error'; });
    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Suggestions import failed'));
  });
});
