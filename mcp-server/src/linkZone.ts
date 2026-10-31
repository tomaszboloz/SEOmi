/** Link zone from DOM ancestry, same rules and ids as the app crawler (#70). */
export type LinkZone = 'main' | 'widget' | 'nav_breadcrumb' | 'sidebar_footer' | 'unknown';

export const readAttribute = (attributes: string, name: string): string => {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attributes);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim();
};

/** Zone named by one element and its rank; a higher rank wins over ancestors, as in the app. */
export const elementZone = (tag: string, attributes: string): [LinkZone, number] | null => {
  const role = readAttribute(attributes, 'role').toLowerCase();
  const tokens = `${readAttribute(attributes, 'id')} ${readAttribute(attributes, 'class')}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const has = (words: string[]) => tokens.some((token) => words.includes(token));
  if (tag === 'nav' || tag === 'header' || role === 'navigation' || role === 'banner'
    || has(['breadcrumb', 'breadcrumbs', 'navbar', 'menu'])) return ['nav_breadcrumb', 4];
  if (tag === 'aside' || tag === 'footer' || role === 'complementary' || role === 'contentinfo'
    || has(['sidebar', 'footer'])) return ['sidebar_footer', 3];
  if (has(['widget'])) return ['widget', 2];
  if (tag === 'main' || role === 'main') return ['main', 1];
  return null;
};

/** E-mails, long digit runs and token-like strings never leave the audit as context. */
export const redactWord = (word: string): string => {
  const core = word.replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}@]+$/gu, '');
  const digits = (core.match(/[0-9]/g) || []).length;
  const letters = (core.match(/[a-z]/gi) || []).length;
  if (core.includes('@') && core.includes('.')) return '[email]';
  if (digits >= 9 && digits * 2 >= [...core].length) return '[number]';
  if (core.length >= 24 && digits > 0 && letters > 0) return '[token]';
  return word;
};
