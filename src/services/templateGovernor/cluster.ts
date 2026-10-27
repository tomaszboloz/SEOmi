export interface TemplatePage {
  url: string;
  /** Visible body text of the crawled page. */
  text: string;
  /** Optional DOM skeleton (tag sequence); pages with different skeletons never share a template. */
  domSignature?: string;
}

export interface TemplateCluster {
  /** URL pattern such as `/dieta-cukrzycowa-{var}`. */
  pattern: string;
  pages: TemplatePage[];
}

const SLUG_TOKENS_IN_PATTERN = 2;

const pathOf = (url: string): string => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).pathname;
  } catch {
    return '';
  }
};

/** `/a/dieta-cukrzycowa-krakow` becomes `/a/dieta-cukrzycowa-{var}`; short slugs become `/a/{var}`. */
export const patternOf = (url: string): string => {
  const segments = pathOf(url).split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  const slug = segments[segments.length - 1].replace(/\.[a-z0-9]{2,5}$/i, '');
  const tokens = slug.split('-').filter(Boolean);
  const dir = segments.slice(0, -1).map((segment) => `/${segment}`).join('');
  const keep = Math.min(SLUG_TOKENS_IN_PATTERN, tokens.length - 1);
  return `${dir}/${keep > 0 ? `${tokens.slice(0, keep).join('-')}-` : ''}{var}`;
};

/** Groups pages by URL pattern and DOM skeleton. Clusters are sorted by size, biggest first. */
export const clusterTemplates = (pages: TemplatePage[]): TemplateCluster[] => {
  const groups = new Map<string, TemplateCluster>();
  for (const page of pages) {
    const pattern = patternOf(page.url);
    const key = `${pattern}|${page.domSignature ?? ''}`;
    const group = groups.get(key) ?? { pattern, pages: [] };
    group.pages.push(page);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.pages.length - a.pages.length || a.pattern.localeCompare(b.pattern));
};
