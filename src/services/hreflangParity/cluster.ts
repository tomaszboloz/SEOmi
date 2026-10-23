export interface HreflangPage {
  url: string;
  hreflangs: Array<{ language: string; target_url: string; target_checked_in_run?: boolean; reciprocal_in_run?: boolean | null }>;
}

export type ClusterIssue = 'invalid-code' | 'missing-reciprocal' | 'missing-x-default' | 'missing-self' | 'target-not-crawled';

export interface HreflangCluster {
  urls: string[];
  /** Language code (lowercase) to URLs that declare it inside this cluster. */
  languages: Map<string, string[]>;
  issues: Array<{ code: ClusterIssue; url: string; detail?: string }>;
}

const CODE = /^(?:x-default|[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?)$/;

export const normalizeUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim();
  }
};

export const normalizeCode = (code: string): string => code.trim().toLowerCase().replace(/_/g, '-');

/** Groups pages connected by hreflang annotations. A broken graph is a technical issue, not a content gap. */
export const buildClusters = (pages: HreflangPage[]): HreflangCluster[] => {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) { parent.set(x, x); return x; }
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  pages.filter((p) => p.hreflangs.length).forEach((page) => {
    const from = normalizeUrl(page.url);
    find(from);
    page.hreflangs.forEach((h) => parent.set(find(normalizeUrl(h.target_url)), find(from)));
  });
  const groups = new Map<string, HreflangPage[]>();
  pages.filter((p) => p.hreflangs.length).forEach((p) => {
    const root = find(normalizeUrl(p.url));
    groups.set(root, [...(groups.get(root) ?? []), p]);
  });
  return [...groups.values()].map(clusterOf).sort((a, b) => (a.urls[0] < b.urls[0] ? -1 : 1));
};

const clusterOf = (members: HreflangPage[]): HreflangCluster => {
  const cluster: HreflangCluster = { urls: members.map((m) => normalizeUrl(m.url)).sort(), languages: new Map(), issues: [] };
  members.forEach((page) => {
    const self = normalizeUrl(page.url);
    const codes = page.hreflangs.map((h) => normalizeCode(h.language));
    if (!codes.includes('x-default')) cluster.issues.push({ code: 'missing-x-default', url: self });
    if (!page.hreflangs.some((h) => normalizeUrl(h.target_url) === self)) cluster.issues.push({ code: 'missing-self', url: self });
    page.hreflangs.forEach((h) => {
      const code = normalizeCode(h.language);
      if (!CODE.test(code)) cluster.issues.push({ code: 'invalid-code', url: self, detail: h.language });
      else cluster.languages.set(code, [...new Set([...(cluster.languages.get(code) ?? []), normalizeUrl(h.target_url)])]);
      if (h.reciprocal_in_run === false) cluster.issues.push({ code: 'missing-reciprocal', url: self, detail: h.target_url });
      if (h.target_checked_in_run === false) cluster.issues.push({ code: 'target-not-crawled', url: self, detail: h.target_url });
    });
  });
  return cluster;
};
