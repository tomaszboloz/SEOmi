import type { CrawledPageSummary } from '@/types';

type SpaPayload = NonNullable<CrawledPageSummary['spa_payload']>;

/**
 * Bound the JS-shell payload evidence for persistence (#131).
 *
 * The crawler already caps `text` at 2,000 characters and `links` at 100, so
 * evidence retries 1 and 2 keep the text and only trim links like every other
 * per-page URL list. The final retry (and the page index) drops text and links
 * the same way it drops other source snippets, but keeps the record itself:
 * its presence and `word_count` are what the JS-shell banner counts, so a
 * reloaded compacted run still reports how many shells had a payload read.
 * `truncated` is set because the stored copy no longer holds the full payload.
 */
export const compactSpaPayload = (payload: SpaPayload | undefined, maxLinks: number | 'none'): SpaPayload | undefined => {
  if (!payload) return undefined;
  if (maxLinks !== 'none') {
    const links = payload.links.slice(0, maxLinks);
    return { ...payload, links, truncated: payload.truncated || links.length < payload.links.length };
  }
  return { provenance: payload.provenance, source: payload.source, title: payload.title, text: '', word_count: payload.word_count, links: [], truncated: true };
};
