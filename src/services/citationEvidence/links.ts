import type { CitationReference } from './claims';

const PMID = /^\d{1,9}$/;
const PMCID = /^PMC\d{4,9}$/;

const httpUrl = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Resolver link for one extracted citation reference (#88). DOI, PMID and PMCID keys point to their
 * public resolvers (doi.org, PubMed, PMC); plain URLs are passed through when they are http(s).
 * Numeric markers ("[3]") and author-year notes have no target and return undefined. A link only
 * says where the cited work can be looked up: it is not evidence that the work exists or supports
 * the claim.
 */
export const citationReferenceUrl = (ref: Pick<CitationReference, 'kind' | 'key' | 'raw'>): string | undefined => {
  const [scheme, ...rest] = (ref.key ?? '').split(':');
  const id = rest.join(':');
  if (scheme === 'doi' && /^10\.\d{4,9}\/\S+$/.test(id)) return `https://doi.org/${id.split('/').map(encodeURIComponent).join('/')}`;
  if (scheme === 'pmid' && PMID.test(id)) return `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
  if (scheme === 'pmcid' && PMCID.test(id.toUpperCase())) return `https://pmc.ncbi.nlm.nih.gov/articles/${id.toUpperCase()}/`;
  return ref.kind === 'url' ? httpUrl(ref.raw) : undefined;
};

/** Short display label: the identifier for scholarly ids, otherwise the raw text found on the page. */
export const citationReferenceLabel = (ref: Pick<CitationReference, 'kind' | 'key' | 'raw'>): string => {
  if (ref.key && (ref.kind === 'doi' || ref.kind === 'pmid' || ref.kind === 'pmcid')) {
    const [scheme, ...rest] = ref.key.split(':');
    return `${scheme.toUpperCase()} ${rest.join(':')}`;
  }
  return ref.raw;
};
