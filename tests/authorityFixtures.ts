import type { FocusPage } from '@/services/siteFocus';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { buildTaxonomy, type CompetitorPages } from '@/services/topicalAuthority';
import { createCrawlPageFixture } from './fixtures/crawl';

export const COFFEE = ['coffee', 'espresso', 'roast', 'bean', 'grinder', 'brew', 'barista', 'crema', 'extraction', 'filter', 'arabica', 'kettle'];
export const NOW = '2026-10-01T00:00:00.000Z';

export interface CoffeeSpec {
  path: string;
  title: string;
  h1?: string;
  h2?: string[];
  terms?: string[];
  links?: Array<[string, string]>;
  date?: string;
  noUnique?: boolean;
  patch?: Partial<FocusPage>;
}

/** Page whose terms come from a vocabulary slice; every page also carries a unique word so vectors differ. */
export const coffeePage = (host: string, spec: CoffeeSpec): FocusPage => {
  const terms = spec.terms ?? COFFEE.slice(0, 8);
  return createCrawlPageFixture({
    url: `https://${host}${spec.path}`, final_url: `https://${host}${spec.path}`, title: spec.title, word_count: 900, document_language: 'en',
    depth: spec.path.split('/').filter(Boolean).length,
    focus_terms: [...terms, ...(spec.noUnique ? [] : [`uniq${host.replace(/\W/g, '')}${spec.path.replace(/\W/g, '')}`])].map((term, index) => ({ term, surface: term, count: 3 + (index % 3), weight: 6 + (index % 3) })),
    heading_texts: { h1: [spec.h1 ?? spec.title], h2: spec.h2 ?? [], h3: [] },
    links: (spec.links ?? []).map(([target, anchor]) => ({ target_url: `https://${host}${target}`, anchor_text: anchor, is_internal: true })),
    ...(spec.date ? { content_date: spec.date } : {}),
    ...spec.patch,
  }) as FocusPage;
};

export const OWN_HOST = 'coffee.test';

/** Own site: a hub, two covered topics (one shallow), a near-duplicate pair, an orphan and a stale page. */
export const ownSite = (): FocusPage[] => [
  coffeePage(OWN_HOST, { path: '/', title: 'Coffee guide', terms: COFFEE, links: [['/espresso/machines', 'espresso machines'], ['/brewing/pour-over', 'pour over brewing'], ['/espresso/machine-review', 'read more']], date: '2026-09-01' }),
  coffeePage(OWN_HOST, { path: '/espresso/machines', title: 'Espresso machines', noUnique: true, h2: ['Espresso machines buying guide', 'Machine maintenance'], terms: COFFEE, links: [['/brewing/pour-over', 'pour over brewing'], ['/', 'home'], ['/espresso/machine-review', 'espresso machine review']], date: '2026-08-01' }),
  coffeePage(OWN_HOST, { path: '/espresso/machine-review', title: 'Espresso machines', noUnique: true, h2: ['Espresso machines buying guide'], terms: COFFEE, links: [['/espresso/machines', 'espresso machines']], date: '2024-01-01' }),
  coffeePage(OWN_HOST, { path: '/brewing/pour-over', title: 'Pour over brewing', h2: ['Pour over brewing basics'], terms: ['coffee', 'brew', 'filter', 'kettle', 'bean', 'roast', 'extraction', 'barista'], links: [['/', 'home']], date: '2026-07-01' }),
  coffeePage(OWN_HOST, { path: '/brewing/lonely-page', title: 'Brewing notes', terms: ['coffee', 'brew', 'filter', 'bean', 'roast', 'crema', 'barista', 'arabica'], links: [] }),
  coffeePage(OWN_HOST, { path: '/privacy-policy', title: 'Privacy policy', terms: ['privacy', 'cookies', 'policy'], patch: { word_count: 300 } }),
];

/** Competitor with headings for the three market sub-topics, plus a recurring boilerplate heading. */
export const competitor = (host: string, extra: string[] = []): CompetitorPages => ({
  domain: host,
  pages: [
    coffeePage(host, { path: '/espresso', title: 'Espresso', h2: ['Espresso machines buying guide', 'Boilerplate newsletter', ...extra], terms: [...COFFEE, 'portafilter', 'pressure'] }),
    coffeePage(host, { path: '/pour-over', title: 'Pour over', h2: ['Pour over brewing basics', 'Boilerplate newsletter', 'How do you grind for pour over?'], terms: [...COFFEE, 'gooseneck', 'bloom'] }),
    coffeePage(host, { path: '/grinders', title: 'Grinders', h2: ['Burr grinder comparison', 'Boilerplate newsletter'], terms: [...COFFEE, 'burr', 'grind size'] }),
  ],
});

export const COMPETITORS: CompetitorPages[] = [competitor('rival-one.test'), competitor('rival-two.test'), competitor('rival-three.test', ['Espresso machines buying guide'])];

export const ownReport = (pages = ownSite()) => buildSiteFocusReport(pages, `https://${OWN_HOST}/`, { now: NOW });

export const referenceTaxonomy = (reportPages = ownSite()) => {
  const sfs = ownReport(reportPages);
  return buildTaxonomy({
    coreLabel: sfs.coreTopic.label, coreKeys: new Set(Object.entries(sfs.model.termCluster).filter(([, id]) => id === sfs.model.coreClusterId).map(([key]) => key)),
    language: sfs.model.language, competitors: COMPETITORS, suggestions: ['pour over brewing basics', 'how to descale an espresso machine?'], source: 'bing-rss', now: NOW,
  });
};
