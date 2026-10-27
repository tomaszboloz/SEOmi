import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/Domain/siteAudit/CrawlRenderOptions', () => ({ CrawlRenderOptions: () => <div data-testid="render-options" /> }));
vi.mock('@/components/Domain/siteAudit/configForm/CrawlLimitsConfig', () => ({ CrawlLimitsConfig: () => null }));
vi.mock('@/components/Domain/siteAudit/configForm/CrawlScopeConfig', () => ({ CrawlScopeConfig: () => null }));
vi.mock('@/components/Domain/siteAudit/configForm/CrawlQueryConfig', () => ({ CrawlQueryConfig: () => null }));
vi.mock('@/components/Domain/siteAudit/configForm/CrawlRulesConfig', () => ({ CrawlRulesConfig: () => null }));
vi.mock('@/components/Domain/siteAudit/configForm/CrawlResourceConfig', () => ({ CrawlResourceConfig: () => null }));

const freeSuggestions = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/services/freeSuggestions', async () => ({
  ...(await vi.importActual<typeof import('@/services/freeSuggestions')>('@/services/freeSuggestions')),
  fetchFreeSuggestions: freeSuggestions.fetch,
}));
vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: ({ url }: { url: string }) => <span data-testid="show-on-page">{url}</span> }));

import { CrawlConfigurationForm } from '@/components/Domain/siteAudit/CrawlConfigurationForm';
import { useFreeSuggestionsSession } from '@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession';
import { LinksAudit } from '@/components/Results/LinksAudit';
import { DataForSeoLocationPicker } from '@/components/DataForSEO/pickers/DataForSeoLocationPicker';
import type { DataForSeoMarket } from '@/services/dataforseo';
import type { GoogleSuggestionsResult } from '@/services/freeSuggestions';
import { createAuditFixture } from './fixtures/audit';

describe('CrawlConfigurationForm', () => {
  it('shows render options only for browser-rendered crawls', () => {
    const session = (crawlMode: string) => ({ crawlConfig: { crawlMode } }) as unknown as Parameters<typeof CrawlConfigurationForm>[0]['session'];
    const view = render(<CrawlConfigurationForm session={session('http')} />);
    expect(screen.queryByTestId('render-options')).toBeNull();
    view.rerender(<CrawlConfigurationForm session={session('browser-rendered')} />);
    expect(screen.getByTestId('render-options')).toBeTruthy();
  });
});

describe('useFreeSuggestionsSession remaining branches', () => {
  const source = { kind: 'google-suggest-unofficial', provider: 'Google Suggest', sourceUrl: 'https://suggestqueries.google.com/x', requestedGeo: 'PL', requestedLanguage: 'pl', availability: 'best-effort', reason: 'r' };
  const result = { feed: 'google-suggestions', query: 'seo', suggestions: ['seo audit'], fetchedAt: '2026-10-06T10:00:00Z', sourceUrl: source.sourceUrl, source } as unknown as GoogleSuggestionsResult;
  const props = { projectId: 'p1' as string | null, query: 'seo', geo: 'PL', language: 'pl', savedKeywords: [] as never[], onSave: vi.fn() };
  beforeEach(() => { freeSuggestions.fetch.mockReset(); props.onSave.mockReset(); });

  it('reports a thrown non-Error value as a generic error message', async () => {
    freeSuggestions.fetch.mockRejectedValue('network down');
    const { result: current } = renderHook(() => useFreeSuggestionsSession(props));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(current.current.error).toEqual({ status: 'error', message: 'network down' });
  });

  it('uses the message of a thrown Error', async () => {
    freeSuggestions.fetch.mockRejectedValue(new Error('offline'));
    const { result: current } = renderHook(() => useFreeSuggestionsSession(props));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(current.current.error).toEqual({ status: 'error', message: 'offline' });
  });

  it('drops a rejection that arrives after the query owner changed', async () => {
    let reject: (reason: unknown) => void = () => undefined;
    freeSuggestions.fetch.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
    const { result: current, rerender } = renderHook((value) => useFreeSuggestionsSession(value), { initialProps: props });
    act(() => { void current.current.fetchSuggestions(); });
    rerender({ ...props, query: 'different' });
    await act(async () => { reject(new Error('late failure')); await Promise.resolve(); });
    expect(current.current.error).toBeNull();
    expect(current.current.fetching).toBe(false);
  });

  it('falls back to a generic message when a failed outcome carries no error text', async () => {
    freeSuggestions.fetch.mockResolvedValue({ status: 'blocked', result: null, response: { error: null } });
    const { result: current } = renderHook(() => useFreeSuggestionsSession(props));
    await act(async () => { await current.current.fetchSuggestions(); });
    expect(current.current.error).toEqual({ status: 'blocked', message: 'Google Suggestions unavailable' });
  });

  it('does not save without a project or when the keyword is already saved, and saves without provenance before a result', () => {
    const noProject = renderHook(() => useFreeSuggestionsSession({ ...props, projectId: null }));
    act(() => noProject.result.current.saveSuggestion('seo audit'));
    expect(props.onSave).not.toHaveBeenCalled();

    const saved = renderHook(() => useFreeSuggestionsSession({ ...props, savedKeywords: [{ keyword: ' SEO Audit ' }] as never[] }));
    act(() => saved.result.current.saveSuggestion('seo audit'));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(saved.result.current.isSaved('seo audit')).toBe(true);

    const fresh = renderHook(() => useFreeSuggestionsSession(props));
    act(() => fresh.result.current.saveSuggestion('seo audit'));
    expect(props.onSave).toHaveBeenCalledWith('seo audit', undefined);
  });

  it('attaches provenance once a result is available', async () => {
    freeSuggestions.fetch.mockResolvedValue({ status: 'ok', result, response: { error: null } });
    const { result: current } = renderHook(() => useFreeSuggestionsSession(props));
    await act(async () => { await current.current.fetchSuggestions(); });
    act(() => current.current.saveSuggestion('seo audit'));
    expect(props.onSave).toHaveBeenCalledWith('seo audit', expect.objectContaining({ retrievedAt: result.fetchedAt }));
  });
});

describe('LinksAudit page URL fallback', () => {
  it('uses the requested URL for link context when the audit has no final URL', () => {
    const audit = createAuditFixture({
      url: 'https://requested.test/', final_url: '',
      links: { total_links: 1, internal_links: 1, external_links: 0, nofollow_links: 0, links: [{ href: 'https://requested.test/a', text: 'a', is_internal: true }] },
    });
    render(<LinksAudit audit={audit} />);
    expect(screen.getByTestId('show-on-page').textContent).toBe('https://requested.test/');
  });
});

describe('DataForSeoLocationPicker blur', () => {
  const markets: DataForSeoMarket[] = [
    { code: 'US', label: 'United States', countryIsoCode: 'US', locationCode: 2840, locationType: 'Country', availableSources: 'google', languages: [{ code: 'en', label: 'English' }], catalogRows: [] },
  ];

  it('keeps what the user typed when the current value matches no market', () => {
    render(<DataForSeoLocationPicker value="ZZ" markets={markets} onChange={vi.fn()} ariaLabel="Location" />);
    const input = screen.getByRole('combobox', { name: 'Location' }) as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'typed text' } });
    fireEvent.blur(input);
    expect(input.value).toBe('typed text');
  });
});
