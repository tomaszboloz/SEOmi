import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), add: vi.fn() }));
vi.mock('@/services/freeSuggestions', async () => ({
  ...(await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions')),
  fetchFreeSuggestions: mocks.fetch,
}));

const suggestions = {
  feed: 'google-suggestions' as const, query: 'seo', suggestions: ['seo audit', 'seo tools'], fetchedAt: '2026-10-06T10:00:00Z',
  sourceUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&gl=pl&q=seo',
  source: { kind: 'google-suggest-unofficial' as const, provider: 'Google Suggest' as const, sourceUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&hl=pl&gl=pl&q=seo', requestedGeo: 'PL', requestedLanguage: 'pl', availability: 'best-effort' as const, reason: 'best effort' },
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  mocks.fetch.mockReset(); mocks.add.mockReset();
  useProjectStore.setState({ activeProjectId: 'p1' });
  useToolsStore.setState({ savedKeywords: [], addSavedKeyword: mocks.add } as never);
});

describe('FreeSuggestionsPanel', () => {
  it('fetches, displays provenance and saves a suggestion with a source tag', async () => {
    mocks.fetch.mockResolvedValue({ status: 'ok', response: { status: 'ok', sourceUrl: suggestions.sourceUrl, fetchedAt: suggestions.fetchedAt, body: '[]', httpStatus: 200, error: null }, result: suggestions });
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch suggestions/i }));
    await screen.findByText('seo audit');
    expect(screen.getByText(/unofficial/i)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Save$/i })[0]);
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo audit', search_volume: null, difficulty: null, cpc: null, intent: 'Unknown', tags: ['Google Suggest'] }));
    expect(mocks.add.mock.calls[0][0].provenance).toMatchObject({ requestedGeo: 'PL', requestedLanguage: 'pl', retrievedAt: suggestions.fetchedAt });
  });

  it('shows blocked feed errors and disables fetching without a project', async () => {
    mocks.fetch.mockResolvedValue({ status: 'blocked', result: null, response: { error: 'HTTP 429' } });
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: /Fetch suggestions/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('HTTP 429'));
    useProjectStore.setState({ activeProjectId: null });
    await waitFor(() => expect((screen.getByRole('button', { name: /Fetch suggestions/i }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getByText(/Select a project/i)).toBeTruthy();
  });

  it('imports local suggestions and saves them with user provenance', async () => {
    render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.change(screen.getByRole('textbox', { name: /Suggestions payload/i }), { target: { value: '["seo audit", "SEO audit"]' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Source URL/i }), { target: { value: 'https://export.example.test' } });
    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));
    await screen.findByText('seo audit');
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'seo audit', search_volume: null, difficulty: null, cpc: null, intent: 'Unknown', tags: ['User import'], provenance: expect.objectContaining({ kind: 'user-import', sourceUrl: 'https://export.example.test/' }) }));
  });

  it('clears imported suggestions when the query owner changes', async () => {
    const { rerender } = render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    fireEvent.change(screen.getByRole('textbox', { name: /Suggestions payload/i }), { target: { value: '["seo audit"]' } });
    fireEvent.click(screen.getByRole('button', { name: /^Import$/i }));
    await screen.findByText('seo audit');
    rerender(<FreeSuggestionsPanel query="different" geo="PL" language="pl" />);
    await waitFor(() => expect(screen.queryByText('seo audit')).toBeNull());
    expect((screen.getByRole('textbox', { name: /Suggestions payload/i }) as HTMLTextAreaElement).value).toBe('');
  });
});
