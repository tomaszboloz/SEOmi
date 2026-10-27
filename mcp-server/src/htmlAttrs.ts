const ATTR_PATTERN = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const decodeAttr = (value: string): string => value
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&');

/** Attributes of one tag body, keyed by lowercase name. Handles "…", '…' and unquoted values. */
export const parseTagAttrs = (tagBody: string): Map<string, string> => {
  const attrs = new Map<string, string>();
  for (const match of tagBody.matchAll(ATTR_PATTERN)) {
    const name = match[1].toLowerCase();
    if (!attrs.has(name)) attrs.set(name, decodeAttr(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return attrs;
};

export const extractAttr = (tagBody: string, name: string): string | null =>
  parseTagAttrs(tagBody).get(name.toLowerCase()) ?? null;

const tagAttrs = (html: string, tag: string): Array<Map<string, string>> =>
  Array.from(html.matchAll(new RegExp(`<${tag}\\b((?:"[^"]*"|'[^']*'|[^>"'])*)>`, 'gi')), (match) => parseTagAttrs(match[1]));

/** First `<meta name|property=…>` content, independent of attribute order. */
export const firstMeta = (html: string, name: string): string | null => {
  const wanted = name.toLowerCase();
  for (const attrs of tagAttrs(html, 'meta')) {
    const key = (attrs.get('name') ?? attrs.get('property') ?? '').toLowerCase();
    const content = attrs.get('content');
    if (key === wanted && content !== undefined && content !== '') return content;
  }
  return null;
};

/** First `<link>` whose rel token list contains `canonical`, independent of attribute order. */
export const canonicalHref = (html: string): string | null => {
  for (const attrs of tagAttrs(html, 'link')) {
    const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    const href = attrs.get('href');
    if (rel.includes('canonical') && href) return href;
  }
  return null;
};
