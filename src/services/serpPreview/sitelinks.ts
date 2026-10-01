import type { LinkData } from '@/types';
import type { SerpSitelinkCandidate } from './types';

export const formatSerpDisplayUrl = (input: string): string => {
  try {
    const url = new URL(input);
    const path = url.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => {
        try { return decodeURIComponent(part); } catch { return part; }
      })
      .join(' › ');
    return path ? `${url.hostname} › ${path}` : url.hostname;
  } catch {
    return input;
  }
};

/**
 * Builds a bounded list of local sitelink candidates from links present in the
 * audited document. Google may ignore or rewrite these; the candidates are
 * evidence from this response, never a predicted live SERP result.
 */
export const deriveSerpSitelinks = (links: LinkData[], pageUrl: string, limit = 6): SerpSitelinkCandidate[] => {
  let page: URL;
  try {
    page = new URL(pageUrl);
    page.hash = "";
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return links.flatMap((link) => {
    if (!link.is_internal || !link.text.trim()) return [];
    try {
      const target = new URL(link.href, page);
      target.hash = '';
      if (target.origin !== page.origin || target.href === page.href || seen.has(target.href)) return [];
      seen.add(target.href);
      return [{ url: target.href, label: link.text.replace(/\s+/gu, ' ').trim().slice(0, 80), displayUrl: formatSerpDisplayUrl(target.href) }];
    } catch {
      return [];
    }
  }).slice(0, Math.max(0, Math.min(limit, 12)));
};

