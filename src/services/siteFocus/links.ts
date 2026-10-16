import { normalizeUrl } from './pageType';
import type { FocusPage, LinkSuggestion, PageFocus } from './types';

const MAX_HUBS = 5;
const HUBS_PER_SOURCE = 2;
const ANCHORS = 3;
const MAX_SUGGESTIONS = 50;

const byTrs = (a: PageFocus, b: PageFocus): number => b.trs - a.trs || (a.url < b.url ? -1 : 1);

/**
 * Internal-linking suggestions: weak and borderline pages that do not yet link to a strong hub.
 * Hubs are strong category pages; without any, the strongest content pages stand in.
 */
export const buildLinkSuggestions = (focus: PageFocus[], sources: FocusPage[]): LinkSuggestion[] => {
  const live = focus.filter((page) => !page.skipped && page.type !== 'technical');
  const strong = live.filter((page) => page.trs >= 75).sort(byTrs);
  const categories = strong.filter((page) => page.type === 'category');
  const hubs = (categories.length ? categories : strong.filter((page) => page.type !== 'homepage')).slice(0, MAX_HUBS);
  const linksByUrl = new Map(sources.map((page) => [page.url, new Set(page.links.filter((link) => link.is_internal).map((link) => normalizeUrl(link.target_url)))]));
  const needy = live.filter((page) => page.trs >= 40 && page.trs < 75).sort((a, b) => a.trs - b.trs || (a.url < b.url ? -1 : 1));
  const suggestions: LinkSuggestion[] = [];
  needy.forEach((page) => {
    const existing = linksByUrl.get(page.url) ?? new Set<string>();
    hubs.filter((hub) => !existing.has(normalizeUrl(hub.url))).slice(0, HUBS_PER_SOURCE).forEach((hub) => {
      suggestions.push({ code: 'link-to-hub', fromUrl: page.url, toUrl: hub.url, anchors: hub.keywordsFound.slice(0, ANCHORS).map((keyword) => keyword.term) });
    });
  });
  return suggestions.slice(0, MAX_SUGGESTIONS);
};
