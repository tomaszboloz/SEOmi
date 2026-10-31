import { decodeText } from './auditSemantic.js';
import { elementZone, readAttribute, redactWord, type LinkZone } from './linkZone.js';

/** One link with the placement evidence the app crawler records (#70). */
export interface PublicLinkDetail {
  url: string;
  anchor_text: string;
  rel: string | null;
  nofollow: boolean;
  is_internal: boolean;
  zone: LinkZone;
  /** Static HTML has no viewport, so fold position is never claimed. */
  zone_method: 'html-ancestry';
  context_before: string | null;
  context_after: string | null;
}

export const MAX_LINK_DETAILS = 500;
const CONTEXT_WORDS = 15;
const BLOCKS = new Set(['p', 'li', 'td', 'dd', 'blockquote', 'div', 'section', 'article', 'main']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const HIDDEN = /<(script|style|noscript|template|svg|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;
const TOKENS = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>|<|[^<]+/g;

type Range = { start: number; end: number | null };
type Frame = { tag: string; zone: [LinkZone, number] | null; block: Range | null };
type Open = { detail: PublicLinkDetail; block: Range | null; start: number };

const toUrl = (href: string, base: URL): URL | null => {
  try {
    const url = new URL(href, base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
};

const zoneOf = (stack: Frame[]): LinkZone => stack.reduce<[LinkZone, number]>(
  (found, frame) => (frame.zone && frame.zone[1] > found[1] ? frame.zone : found),
  ['unknown', 0],
)[0];

const join = (words: string[]): string | null => (words.length ? words.join(' ') : null);

/** Links with anchor, rel, DOM zone and up to 15 words of context in the nearest block. */
export const extractLinkDetails = (html: string, base: URL): { links: PublicLinkDetail[]; truncated: boolean } => {
  const words: string[] = [];
  const stack: Frame[] = [];
  const done: Array<Open & { end: number }> = [];
  let open: Open | null = null;
  let truncated = false;
  const close = () => {
    if (!open) return;
    open.detail.anchor_text = words.slice(open.start).join(' ');
    done.push({ ...open, end: words.length });
    open = null;
  };
  for (const [token, slash, rawTag, attributes = ''] of html.replace(HIDDEN, ' ').matchAll(TOKENS)) {
    const tag = rawTag?.toLowerCase();
    if (!tag) {
      words.push(...decodeText(token).split(/\s+/).filter(Boolean).map(redactWord));
    } else if (slash) {
      if (tag === 'a') close();
      const index = stack.map((frame) => frame.tag).lastIndexOf(tag);
      if (index >= 0) stack.splice(index).forEach((frame) => frame.block && (frame.block.end = words.length));
    } else if (tag === 'a') {
      close();
      const href = readAttribute(attributes, 'href');
      const url = href ? toUrl(href, base) : null;
      if (!url) continue;
      if (done.length >= MAX_LINK_DETAILS) {
        truncated = true;
        continue;
      }
      const rel = readAttribute(attributes, 'rel').toLowerCase() || null;
      const block = [...stack].reverse().find((frame) => frame.block)?.block ?? null;
      open = { block, start: words.length, detail: {
        url: url.toString(), anchor_text: '', rel, nofollow: /\bnofollow\b/.test(rel || ''),
        is_internal: url.hostname === base.hostname, zone: zoneOf(stack), zone_method: 'html-ancestry',
        context_before: null, context_after: null,
      } };
    } else if (!VOID.has(tag) && !attributes.trim().endsWith('/')) {
      stack.push({ tag, zone: elementZone(tag, attributes), block: BLOCKS.has(tag) ? { start: words.length, end: null } : null });
    }
  }
  close();
  const links = done.map(({ detail, block, start, end }) => {
    if (!block) return detail;
    const blockEnd = block.end ?? words.length;
    detail.context_before = join(words.slice(Math.max(block.start, start - CONTEXT_WORDS), start));
    detail.context_after = join(words.slice(end, Math.min(blockEnd, end + CONTEXT_WORDS)));
    return detail;
  });
  return { links, truncated };
};
