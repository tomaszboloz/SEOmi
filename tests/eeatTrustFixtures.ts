import type { CrawledLink, CrawledSchemaReference } from '@/types';
import type { FocusPage } from '@/services/siteFocus';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { diabetesSite } from './siteFocusFixtures';

export const HOST = 'diabetes.test';
export const START = `https://${HOST}/`;
export const NOW = '2026-10-16T00:00:00Z';

type Ref = CrawledSchemaReference & { node_path?: string };

export const ref = (decl: number, path: string, property: string, value: string): Ref => ({ format: 'JSON-LD', declaration_index: decl, property, value, node_path: path });

/** One JSON-LD node as the crawler reports it: @id/@type/name plus extra properties. */
export const node = (path: string, fields: { id?: string; type?: string | string[]; name?: string; props?: Array<[string, string]> }, decl = 0): Ref[] => [
  ...(fields.id ? [ref(decl, path, '@id', fields.id)] : []),
  ...[fields.type ?? []].flat().map((type) => ref(decl, path, '@type', type)),
  ...(fields.name ? [ref(decl, path, 'name', fields.name)] : []),
  ...(fields.props ?? []).map(([property, value]) => ref(decl, path, property, value)),
];

export const extLink = (target: string, status?: number, error?: string): CrawledLink => ({
  target_url: target, anchor_text: 'source', is_internal: false, target_http_status: status, target_request_error_kind: error,
});

export const withRefs = (page: FocusPage, refs: Ref[], links: CrawledLink[] = []): FocusPage => ({
  ...page, schema_references: refs, links: [...page.links, ...links],
});

export const diabetesPages = (): FocusPage[] => diabetesSite(HOST);
export const diabetesFocus = (pages: FocusPage[] = diabetesPages()) => buildSiteFocusReport(pages, START, { now: NOW });

export const AUTHOR_ID = 'https://diabetes.test/authors/anna#person';
export const ORG_ID = 'https://diabetes.test/#organization';

/** A fully attributed article: Person author with id/sameAs/bio, reviewer, dates, citation. */
export const trustedArticle = (page: FocusPage): FocusPage => withRefs(page, [
  ...node('$', { type: 'MedicalWebPage', props: [['author', AUTHOR_ID], ['reviewedBy', AUTHOR_ID], ['dateModified', '2026-09-01'], ['citation', 'https://pubmed.ncbi.nlm.nih.gov/1/'], ['publisher', ORG_ID]] }),
  ...node('$.@graph[1]', { id: AUTHOR_ID, type: 'Person', name: 'Anna Nowak', props: [['jobTitle', 'Diabetes insulin specialist'], ['knowsAbout', 'glucose'], ['sameAs', 'https://orcid.org/0000-0000-0000-0001']] }, 1),
  ...node('$.@graph[2]', { id: ORG_ID, type: 'Organization', name: 'Diabetes Portal', props: [['sameAs', 'https://www.wikidata.org/wiki/Q1']] }, 1),
], [extLink('https://www.who.int/diabetes', 200), extLink('https://blog.example/post', 200)]);
