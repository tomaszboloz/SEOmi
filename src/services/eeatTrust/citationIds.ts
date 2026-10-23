import { hostMatches } from './identifiers';

export interface ScholarlyIds { doi?: string; pmid?: string; pmcid?: string }

const DOI = /(10\.\d{4,9}\/[^\s"'<>?#]+)/i;

const safePath = (path: string): string => {
  try { return decodeURIComponent(path); } catch { return path; }
};

/** DOI, PMID or PMCID carried by a cited URL. Host is matched on a dot boundary, so look-alike domains yield nothing. */
export const scholarlyIds = (target: string): ScholarlyIds => {
  let url: URL;
  try { url = new URL(target.trim()); } catch { return {}; }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = safePath(url.pathname);
  if (hostMatches(host, 'doi.org')) {
    const doi = DOI.exec(path.slice(1))?.[1];
    return doi ? { doi: doi.toLowerCase().replace(/[.,;)]+$/, '') } : {};
  }
  if (host === 'pubmed.ncbi.nlm.nih.gov') {
    const pmid = /^\/(\d{1,9})\/?$/.exec(path)?.[1];
    return pmid ? { pmid } : {};
  }
  if (hostMatches(host, 'ncbi.nlm.nih.gov')) {
    const pmcid = /\/(PMC\d{4,9})\b/i.exec(path)?.[1]?.toUpperCase();
    const pmid = /^\/pubmed\/(\d{1,9})\/?$/.exec(path)?.[1];
    return { ...(pmcid ? { pmcid } : {}), ...(pmid ? { pmid } : {}) };
  }
  return {};
};

/** Stable dedupe key for one identified source. */
export const scholarlyKey = (ids: ScholarlyIds): string | undefined =>
  ids.doi ? `doi:${ids.doi}` : ids.pmid ? `pmid:${ids.pmid}` : ids.pmcid ? `pmcid:${ids.pmcid}` : undefined;
