import type { FocusPage } from '@/services/siteFocus';

export interface PageChanges { added: FocusPage[]; changed: FocusPage[]; unseenSitemapUrls: string[] }

/** New or modified pages (content hash) between two crawls; sitemap URLs the crawl never reached are listed apart. */
export const detectChangedPages = (base: FocusPage[], latest: FocusPage[], sitemapUrls: string[] = []): PageChanges => {
  const before = new Map(base.map((page) => [page.url, page]));
  const added = latest.filter((page) => !before.has(page.url));
  const changed = latest.filter((page) => {
    const old = before.get(page.url);
    return Boolean(old && old.content_hash && page.content_hash && old.content_hash !== page.content_hash);
  });
  const crawled = new Set(latest.map((page) => page.url));
  return { added, changed, unseenSitemapUrls: sitemapUrls.filter((url) => !crawled.has(url)) };
};
