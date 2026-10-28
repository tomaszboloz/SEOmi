import type { CrawledPageSummary, RenderedPageSnapshot } from '@/types';

export interface RenderedCounts { title: string; words: number; internalLinks: number }
export interface ShellRenderComparison {
  url: string;
  raw: RenderedCounts;
  rendered: RenderedCounts;
  /** Rendered minus raw words; positive means the browser exposed content the static HTML lacked. */
  wordDelta: number;
  htmlTruncated: boolean;
  consoleErrors: number;
}

const NON_CONTENT = 'script, style, noscript, template, svg';
const words = (text: string): number => text.split(/\s+/u).filter(Boolean).length;

/** Word count per text node: textContent would glue adjacent elements ("<p>a</p><a>b</a>" -> "ab"). */
const textWords = (root: Node | null): number => {
  if (!root) return 0;
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) total += words(node.nodeValue ?? '');
  return total;
};

const hostOf = (value: string): string => {
  try { return new URL(value).host.toLowerCase(); } catch { return ''; }
};

/** Title, visible-text words and unique same-host links of the rendered DOM; scripts and styles are not content. */
export const renderedCounts = (snapshot: Pick<RenderedPageSnapshot, 'html' | 'finalUrl'>): RenderedCounts => {
  const doc = new DOMParser().parseFromString(snapshot.html, 'text/html');
  doc.querySelectorAll(NON_CONTENT).forEach((node) => node.remove());
  const host = hostOf(snapshot.finalUrl);
  const links = new Set<string>();
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    try {
      const url = new URL(anchor.getAttribute('href') ?? '', snapshot.finalUrl);
      url.hash = '';
      if ((url.protocol === 'http:' || url.protocol === 'https:') && url.host.toLowerCase() === host) links.add(url.href);
    } catch { /* malformed href: not a link */ }
  });
  return { title: doc.title.trim(), words: textWords(doc.body), internalLinks: links.size };
};

export const compareShellRender = (page: CrawledPageSummary, snapshot: RenderedPageSnapshot): ShellRenderComparison => {
  const raw: RenderedCounts = { title: (page.title ?? '').trim(), words: page.word_count, internalLinks: page.internal_link_count };
  const rendered = renderedCounts(snapshot);
  return {
    url: page.url, raw, rendered, wordDelta: rendered.words - raw.words,
    htmlTruncated: snapshot.htmlTruncated, consoleErrors: snapshot.consoleErrors.length,
  };
};
