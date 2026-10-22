/** Inner HTML of every top-level `<tag>` element, matching nested same-name tags by open/close balance. */
export const balancedBlocks = (html: string, tag: string): Array<{ attrs: string; inner: string }> => {
  const blocks: Array<{ attrs: string; inner: string }> = [];
  const pattern = new RegExp(`<(/?)${tag}\\b((?:"[^"]*"|'[^']*'|[^>"'])*)>`, 'gi');
  let depth = 0;
  let start = 0;
  let attrs = '';
  for (const match of html.matchAll(pattern)) {
    if (match[1]) {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0) blocks.push({ attrs, inner: html.slice(start, match.index) });
    } else if (!match[2].trimEnd().endsWith('/')) {
      if (depth === 0) { start = match.index + match[0].length; attrs = match[2]; }
      depth += 1;
    }
  }
  if (depth > 0) blocks.push({ attrs, inner: html.slice(start) });
  return blocks;
};

/** `<main>` wins; otherwise the first visible `<article>`. Hidden/chrome roots are skipped. */
export const primaryRoot = (html: string, isChrome: (attrs: string) => boolean): string | null => {
  for (const tag of ['main', 'article']) {
    const found = balancedBlocks(html, tag).find((block) => !isChrome(block.attrs) && block.inner.trim());
    if (found) return found.inner;
  }
  return null;
};
