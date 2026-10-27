export interface TemplatePage {
  url: string;
  /** Visible body text of the crawled page. */
  text: string;
  /** Optional DOM skeleton (tag sequence); pages with different skeletons never share a template. */
  domSignature?: string;
  domSignatureProvenance?: 'crawler' | 'unavailable';
  /** Variables explicitly captured by the crawler; absent is not inferred from the URL. */
  injectedVariables?: string[];
  injectedVariablesProvenance?: 'crawler' | 'unavailable';
  /** Optional report-scoped TAS identity for representative projection. */
  subtopicId?: string | null;
  wordCount?: number;
  sampleCoverageRatio?: number;
}

export interface TemplateCluster {
  /** URL pattern such as `/dieta-cukrzycowa-{var}`. */
  pattern: string;
  domSignature?: string;
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

const canonicalUrl = (url: string): string => {
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.trim().toLowerCase();
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

/** Deduplicates repeated observations of the same canonical URL. */
export const uniqueTemplatePages = (pages: TemplatePage[]): TemplatePage[] => {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const url = canonicalUrl(page.url);
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

/** Projects one representative page per explicit TAS subtopic without changing pageCount. */
export const deduplicateTasPages = (pages: TemplatePage[]): TemplatePage[] => {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const id = page.subtopicId?.trim();
    if (!id || seen.has(id)) return !id;
    seen.add(id);
    return true;
  });
};

/** Groups pages by URL pattern and DOM skeleton. Clusters are sorted by size, biggest first. */
export const clusterTemplates = (pages: TemplatePage[]): TemplateCluster[] => {
  const groups = new Map<string, TemplateCluster>();
  for (const page of uniqueTemplatePages(pages)) {
    const pattern = patternOf(page.url);
    const key = `${pattern}|${page.domSignature ?? ''}`;
    const group = groups.get(key) ?? { pattern, domSignature: page.domSignature, pages: [] };
    group.pages.push(page);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.pages.length - a.pages.length || a.pattern.localeCompare(b.pattern));
};
