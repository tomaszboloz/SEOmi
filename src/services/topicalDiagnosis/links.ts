import { normalizeGraphUrl } from '@/services/semanticGraph/urls';
import type { DiagnosisDocument } from './types';

/** Links between documents, resolved through every URL alias of a document. */
export interface DocumentLinkIndex {
  outgoing: Map<string, Set<string>>;
  incoming: Map<string, Set<string>>;
  linksTo: (source: string, target: string) => boolean;
}

/** `content` uses main-content links only; `all` adds every captured link (navigation, breadcrumbs, footer). */
export type LinkSource = 'content' | 'all';

const pageLinks = (page: DiagnosisDocument['pages'][number], source: LinkSource) =>
  source === 'all' ? [...(page.semantic_links ?? []), ...(page.links ?? [])] : page.semantic_links ?? [];

export const indexDocumentLinks = (documents: DiagnosisDocument[], source: LinkSource = 'content'): DocumentLinkIndex => {
  const documentByUrl = new Map<string, string>();
  documents.forEach((document) => document.urls.forEach((url) => {
    // A URL that two documents claim (redirect alias) has no owner, as in the semantic graph.
    documentByUrl.set(url, documentByUrl.has(url) && documentByUrl.get(url) !== document.id ? '' : document.id);
  }));
  const outgoing = new Map<string, Set<string>>(documents.map((document) => [document.id, new Set<string>()]));
  const incoming = new Map<string, Set<string>>(documents.map((document) => [document.id, new Set<string>()]));
  documents.forEach((document) => document.pages.forEach((page) => pageLinks(page, source).forEach((link) => {
    if (!link.is_internal) return;
    const target = documentByUrl.get(normalizeGraphUrl(link.target_url, page.final_url || page.url));
    if (!target || target === document.id) return;
    outgoing.get(document.id)!.add(target);
    incoming.get(target)!.add(document.id);
  })));
  return { outgoing, incoming, linksTo: (source, target) => outgoing.get(source)?.has(target) ?? false };
};
