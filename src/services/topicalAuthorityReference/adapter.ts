import { fetchFreeSuggestions } from '@/services/freeSuggestions';
import { createBenchmarkDeps } from '@/services/siteFocusBenchmark';
import { useToolsStore } from '@/stores/toolsStore';
import type { ReferenceDeps } from './types';

export type SuggestionFetcher = (request: { feed: 'google-suggestions'; geo: string; language: string; keyword: string }) => Promise<{ status: string; result: { suggestions: string[] } | null }>;

/** Google Suggest phrases for a keyword; any failure yields an empty list. */
export const createSuggestionFetcher = (env: { geo: string; language: string; fetch: SuggestionFetcher }): NonNullable<ReferenceDeps['fetchSuggestions']> =>
  async (keyword) => {
    try {
      const outcome = await env.fetch({ feed: 'google-suggestions', geo: env.geo, language: env.language, keyword });
      return outcome.status === 'ok' && outcome.result ? outcome.result.suggestions : [];
    } catch { return []; }
  };

/** Single place that wires stores and Tauri commands into the pure reference runner. */
export const createReferenceDeps = (): ReferenceDeps => {
  const tools = useToolsStore.getState();
  const { fetchSerp, crawlSite } = createBenchmarkDeps();
  return {
    fetchSerp, crawlSite,
    fetchSuggestions: createSuggestionFetcher({ geo: tools.keywordCountry || 'US', language: tools.keywordLanguage || 'en', fetch: fetchFreeSuggestions as SuggestionFetcher }),
  };
};
