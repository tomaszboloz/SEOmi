import type { PageAuditData } from '@/types';
import type { InspectPage, SuppliedTargetEvidence, SuppliedTopTenEvidence, TopTenContentGapReport, TopTenPageObservation, TopTenSerpRow } from './types';
import { normalizeSerpUrl, selectOrganicTopTen } from './serp';
import { auditText, buildTopics, sectionHeadings, tokenList } from './topics';

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 240);
const hasAuditIdentity = (audit: PageAuditData | null): audit is PageAuditData => Boolean(audit && (audit.url || audit.final_url));
const MISMATCHED_EVIDENCE = 'Inspected page evidence does not match the requested SERP URL';
const matchesRequestedUrl = (requestedUrl: string, audit: PageAuditData): boolean => {
  const requested = normalizeSerpUrl(requestedUrl);
  if (!requested) return false;
  const original = typeof audit.url === 'string' && audit.url.trim() ? normalizeSerpUrl(audit.url) : null;
  if (original) return original === requested;
  return typeof audit.final_url === 'string' && normalizeSerpUrl(audit.final_url) === requested;
};

const observation = (row: TopTenSerpRow, fetchedAt: string | null, audit?: PageAuditData, error?: unknown): TopTenPageObservation => {
  const status = typeof audit?.http_status === 'number' && Number.isFinite(audit.http_status) ? audit.http_status : null;
  const finalUrl = audit && audit.final_url ? audit.final_url : normalizeSerpUrl(row.url as string);
  const hasBody = Boolean(audit?.content_stats?.body_text?.trim());
  const goodStatus = status === null || (status >= 200 && status < 400);
  return {
    rank: row.rank as number,
    url: row.url as string,
    providerTitle: row.title ?? '',
    providerDescription: row.description ?? '',
    fetchedAt,
    status,
    finalUrl,
    availability: error ? 'error' : goodStatus && hasBody ? 'available' : 'unavailable',
    error: error ? errorText(error) : goodStatus && hasBody ? null : status && status >= 400 ? `http-${status}` : 'body-unavailable',
  };
};

export interface ContentGapOptions {
  phrase: string;
  rows: readonly TopTenSerpRow[];
  inspectUrl: InspectPage;
  locationCode?: number | null;
  languageCode?: string | null;
  retrievedAt?: string;
  now?: () => string;
  concurrency?: number;
  targetPageAudit?: PageAuditData | null;
  targetEvidence?: SuppliedTargetEvidence | null;
}

export interface BuildContentGapOptions {
  phrase: string;
  rows: readonly TopTenSerpRow[];
  evidence: readonly SuppliedTopTenEvidence[];
  locationCode?: number | null;
  languageCode?: string | null;
  retrievedAt?: string;
  now?: () => string;
  targetPageAudit?: PageAuditData | null;
  targetEvidence?: SuppliedTargetEvidence | null;
}

const reportFromEvidence = (options: BuildContentGapOptions, selected: TopTenSerpRow[], evidence: readonly SuppliedTopTenEvidence[], now: () => string): TopTenContentGapReport => {
  const byUrl = new Map(evidence.map((item) => [normalizeSerpUrl(item.url)!, item]));
  const audits: Array<PageAuditData | undefined> = [];
  const rows = selected.map((row, index) => {
    const supplied = byUrl.get(normalizeSerpUrl(row.url as string)!);
    const mismatch = supplied?.audit && !matchesRequestedUrl(row.url as string, supplied.audit);
    const evidenceError = supplied?.error ?? (mismatch ? MISMATCHED_EVIDENCE : supplied ? undefined : 'missing-evidence');
    audits[index] = evidenceError ? undefined : supplied?.audit;
    return observation(row, supplied ? supplied.fetchedAt : null, audits[index], evidenceError);
  });
  const available = rows.filter((row) => row.availability === 'available').length;
  const targetAudit = options.targetEvidence?.audit ?? options.targetPageAudit ?? null;
  const targetAvailable = hasAuditIdentity(targetAudit);
  const targetCounts = targetAvailable ? new Map<string, number>() : null;
  if (targetAvailable && targetAudit) tokenList(auditText(targetAudit)).forEach((term) => targetCounts!.set(term, (targetCounts!.get(term) ?? 0) + 1));
  const topicPages = rows.flatMap((row, index) => row.availability === 'available' && audits[index]
    ? [{ rank: row.rank, url: row.url, fetchedAt: row.fetchedAt, status: row.status, text: auditText(audits[index]!), headings: sectionHeadings(audits[index]!) }]
    : []);
  const target = targetAvailable && targetAudit ? { url: targetAudit.final_url || targetAudit.url, text: auditText(targetAudit), wordCount: targetAudit.content_stats?.word_count ?? 0, headings: sectionHeadings(targetAudit) } : null;
  const status = !selected.length || !available ? 'unavailable' : available === selected.length ? 'complete' : 'partial';
  return { phrase: options.phrase.trim(), source: 'supplied-serp', retrievedAt: options.retrievedAt || now(), locationCode: options.locationCode ?? null, languageCode: options.languageCode ?? null, rows, availablePages: available, targetAvailable, status, topics: buildTopics(topicPages, available, targetCounts), corpus: { target, pages: topicPages, requested: selected.length } };
};

/** Builds a report from explicitly supplied SERP rows and page evidence only. */
export const buildTopTenContentGap = (options: BuildContentGapOptions): TopTenContentGapReport => {
  const now = options.now || (() => new Date().toISOString());
  return reportFromEvidence(options, selectOrganicTopTen(options.rows), options.evidence, now);
};

/** Fetches only supplied organic rows; it never discovers or fabricates SERP results. */
export const collectTopTenContentGap = async (options: ContentGapOptions): Promise<TopTenContentGapReport> => {
  const now = options.now || (() => new Date().toISOString());
  const selected = selectOrganicTopTen(options.rows);
  const evidence: SuppliedTopTenEvidence[] = Array(selected.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < selected.length) {
      const index = cursor++;
      const row = selected[index];
      try {
        const audit = await options.inspectUrl(row.url as string);
        if (!matchesRequestedUrl(row.url as string, audit)) throw new Error(MISMATCHED_EVIDENCE);
        evidence[index] = { url: row.url as string, fetchedAt: now(), audit };
        // Keep the callback's returned audit as the only content evidence.
      }
      catch (error) { evidence[index] = { url: row.url as string, fetchedAt: now(), error }; }
    }
  };
  const requestedConcurrency = options.concurrency ?? 2;
  const finiteConcurrency = Number.isFinite(requestedConcurrency) ? Math.floor(requestedConcurrency) : 2;
  const workerCount = Math.min(Math.max(1, finiteConcurrency), Math.max(1, selected.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return reportFromEvidence({ ...options, evidence }, selected, evidence, now);
};
