import { useEffect, useMemo, useState } from 'react';
import type { BacklinkGapReport } from '@/types';
import { fetchSource } from '@/services/offPage/sourceTransport';
import type { SourceEvidence } from '@/services/offPage/sources';
import { normalizeDomain } from '@/services/outreachCopilot/gap';
import { buildOutreachIgos, type OutreachIgosResult } from '@/services/outreachCopilot/igos';
import type { OutreachPageInput } from '@/services/outreachCopilot/igosText';

interface Request { site: string; pages: OutreachPageInput[]; competitors: Array<{ domain: string; rank: number }> }
interface State extends OutreachIgosResult { identity: string; running: boolean }
const EMPTY: State = { report: null, sourceCandidates: [], identity: '', running: false };

const rankFor = (report: BacklinkGapReport, domain: string): number => Math.max(0, ...report.opportunities.flatMap((row) => row.competitor_backlinks
  .filter((link) => normalizeDomain(link.domain) === domain && link.rank !== null && Number.isFinite(link.rank))
  .map((link) => link.rank as number)));

const hash64 = (value: string): string => {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < value.length; i++) h = (h ^ BigInt(value.charCodeAt(i))) * prime;
  return (h & 0xffffffffffffffffn).toString(36);
};

const hashReport = (rep: BacklinkGapReport): string => {
  const rows = rep.opportunities.map((row) =>
    `${row.referring_domain}:${row.target_backlinks}:${row.max_competitor_spam_score ?? ''}:${row.competitor_backlinks.map((c) => `${c.domain}:${c.backlinks}:${c.rank ?? ''}`).join(',')}`
  ).join(';');
  return `${rep.target}::sub=${rep.include_subdomains}::${rep.competitors.join(',')}::${hash64(rows)}`;
};

const hashSections = (sections?: OutreachPageInput['source']['rag_sections']): string =>
  (sections ?? []).map((s) => `${s.heading ?? ''}:${s.paragraphs.join('/')}`).join(';');

const pageIdentity = (p: OutreachPageInput): string => {
  const src = p.source;
  const terms = (src.semantic_terms ?? []).join(',');
  const sections = hashSections(src.rag_sections);
  return `${src.url}::${src.final_url ?? ''}::${src.title ?? ''}::${terms}::${sections}::${hash64(p.text)}`;
};

export const useOutreachIgos = (
  report: BacklinkGapReport | null,
  site: string,
  pages: OutreachPageInput[],
  projectId?: string | null,
): OutreachIgosResult & { running: boolean } => {
  const request = useMemo<Request | null>(() => {
    if (!report || !site.trim() || !pages.length) return null;
    const competitors = [...new Set(report.competitors.slice(0, 3).map(normalizeDomain).filter(Boolean))]
      .map((domain) => ({ domain, rank: rankFor(report, domain) }));
    return { site, pages, competitors };
  }, [pages, report, site]);

  const activeIdentity = useMemo(() => {
    if (!request || !report) return '';
    return `pid=${projectId ?? 'none'}::site=${site}::${hashReport(report)}::pages=${pages.map(pageIdentity).join('|')}`;
  }, [projectId, request, report, site, pages]);

  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    const abort = new AbortController();
    if (!request || !activeIdentity) {
      setState(EMPTY);
      return () => abort.abort();
    }
    setState({ report: null, sourceCandidates: [], identity: activeIdentity, running: true });
    const initial: SourceEvidence[] = request.competitors.map(({ domain, rank }) => ({
      sourceUrl: `https://${domain}`, authority: rank, fetchedAt: null, availability: null, text: '', vector: null,
    }));
    void Promise.all(initial.map((source) => fetchSource(source, abort.signal)))
      .then((sources) => buildOutreachIgos({
        site: request.site,
        targetPages: request.pages,
        competitorSources: sources.map((source) => ({
          sourceUrl: source.sourceUrl,
          rank: source.authority ?? 0,
          availability: source.availability,
          text: source.text,
          fetchedAt: source.fetchedAt,
        })),
      }))
      .then((result) => {
        if (!abort.signal.aborted) setState({ ...result, identity: activeIdentity, running: false });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ report: null, sourceCandidates: [], identity: activeIdentity, running: false });
      });
    return () => abort.abort();
  }, [request, activeIdentity]);

  if (state.identity !== activeIdentity || !activeIdentity) {
    return { report: null, sourceCandidates: [], running: Boolean(request && activeIdentity) };
  }
  return { report: state.report, sourceCandidates: state.sourceCandidates, running: state.running };
};
