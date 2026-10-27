export interface TemplatePage {
  url: string;
  /** Visible body text of the crawled page. */
  text: string;
  /** Optional DOM skeleton (tag sequence); pages with different skeletons never share a template. */
  domSignature?: string;
  /** Provenance of the optional DOM skeleton. */
  domSignatureProvenance?: 'crawler' | 'unavailable';
  /** Optional variables captured while rendering the template. */
  injectedVariables?: string[];
  /** Provenance of the optional injected-variable evidence. */
  injectedVariablesProvenance?: 'crawler' | 'unavailable';
  /** Optional TAS identity; one representative page is retained per sub-topic. */
  subtopicId?: string | null;
  /** Optional total word count reported by crawler. */
  wordCount?: number;
  /** Estimated sample coverage ratio (0 to 1). */
  sampleCoverageRatio?: number;
}

export interface TemplateCluster {
  /** URL pattern such as `/dieta-cukrzycowa-{var}`. */
  pattern: string;
  /** DOM skeleton used with the URL pattern, when the crawl supplied one. */
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

/** The URL value represented by `{var}`; useful when rendered text omits the injected value. */
export const variableOf = (url: string): string => {
  const segments = pathOf(url).split('/').filter(Boolean);
  const slug = segments.at(-1)?.replace(/\.[a-z0-9]{2,5}$/i, '') ?? '';
  const tokens = slug.split('-').filter(Boolean);
  return tokens.slice(Math.min(SLUG_TOKENS_IN_PATTERN, Math.max(0, tokens.length - 1))).join('-');
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

/** Deduplicates crawl repeats of the same URL. */
export const uniqueTemplatePages = (pages: TemplatePage[]): TemplatePage[] => {
  const seenUrls = new Set<string>();
  return pages.filter((page) => {
    const url = canonicalUrl(page.url);
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });
};

/** TAS projection: retains one representative page per TAS sub-topic node; pages without subtopics are kept. */
export const deduplicateTasPages = (pages: TemplatePage[]): TemplatePage[] => {
  const seenSubtopics = new Set<string>();
  return pages.filter((page) => {
    const subtopic = page.subtopicId?.trim();
    if (!subtopic) return true;
    if (seenSubtopics.has(subtopic)) return false;
    seenSubtopics.add(subtopic);
    return true;
  });
};

/** Groups pages by URL pattern and DOM skeleton without prematurely discarding subtopic URLs. Clusters are sorted by size, biggest first. */
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
