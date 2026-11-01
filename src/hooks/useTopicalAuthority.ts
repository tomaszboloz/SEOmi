import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CrawlRunRecord, CrawledPageSummary } from '@/types';
import type { FocusPage, SiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport, type ReferenceTaxonomy, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import {
  readAuthorityHistory, readTaxonomy, readTopicalBenchmark, recordAuthority, validAuthorityProject, writeTaxonomy, clearTaxonomy, taxonomyMatchesCore,
  type AuthorityHistoryEntry,
} from '@/services/topicalAuthorityMonitoring';
import {
  buildTopicalBenchmark, createReferenceDeps, referenceMarket, runReference, withSerpEvidence,
  type ReferenceInput, type ReferenceOutcome, type ReferenceProgress, type TopicalBenchmark,
} from '@/services/topicalAuthorityReference';

import { useSemanticEmbeddings } from '@/hooks/useSemanticEmbeddings';
import { recordReferenceSnapshot } from '@/services/semanticDecay/recordReferenceSnapshot';

export interface ReferenceRunOptions { /** Opt-in real People Also Ask via the separately billed advanced SERP. */ withQuestions?: boolean }
export type ReferenceRunner = (input: ReferenceInput, options?: ReferenceRunOptions) => Promise<ReferenceOutcome>;
export const defaultReferenceRunner: ReferenceRunner = (input, options) => runReference(createReferenceDeps(options), input);

export interface ReferenceState {
  running: boolean;
  progress: ReferenceProgress | null;
  /** Last run result that did not produce a map (unavailable / cancelled). */
  failure: Exclude<ReferenceOutcome, { status: 'ok' }> | null;
  error: string | null;
}

const IDLE: ReferenceState = { running: false, progress: null, failure: null, error: null };

const domainOf = (startUrl: string): string => {
  try { return new URL(startUrl).hostname.replace(/^www\./, ''); } catch { return startUrl; }
};

export interface UseTopicalAuthorityArgs {
  pages: CrawledPageSummary[];
  startUrl: string;
  sfs: SiteFocusReport | null | undefined;
  run?: CrawlRunRecord | null;
  projectId?: string | null;
  runner?: ReferenceRunner;
  /** Market of the reference SERP; defaults to the keyword country/language settings. */
  market?: () => { country: string; language: string };
}

/** Topical Authority for a crawl: report, cached reference map, competitor benchmark, history and the map builder. */
export const useTopicalAuthority = ({ pages, startUrl, sfs, run, projectId, runner = defaultReferenceRunner, market = referenceMarket }: UseTopicalAuthorityArgs) => {
  const { set: embeddings } = useSemanticEmbeddings(projectId, pages);
  const [taxonomy, setTaxonomy] = useState<ReferenceTaxonomy | null>(() => readTaxonomy(projectId));
  const [benchmark, setBenchmark] = useState<TopicalBenchmark | null>(() => readTopicalBenchmark(projectId));
  const [history, setHistory] = useState<AuthorityHistoryEntry[]>(() => readAuthorityHistory(projectId));
  const [state, setState] = useState<ReferenceState>(IDLE);
  const [scope, setScope] = useState(projectId);
  const controller = useRef<AbortController | null>(null);
  const [pendingBenchmark, setPendingBenchmark] = useState<TopicalBenchmark | null>(null);

  if (scope !== projectId) {
    setScope(projectId);
    setTaxonomy(readTaxonomy(projectId));
    setBenchmark(readTopicalBenchmark(projectId));
    setHistory(readAuthorityHistory(projectId));
    setPendingBenchmark(null);
  }

  useEffect(() => () => controller.current?.abort(), []);

  // A cached map built for another Core Topic, language or SERP market is not applied (treated as absent until rebuilt).
  const usable = taxonomy && sfs && taxonomyMatchesCore(taxonomy, { coreLabel: sfs.coreTopic.label, language: sfs.model.language, market: market() }) ? taxonomy : null;
  const report = useMemo<TopicalAuthorityReport | null>(
    () => (sfs ? buildAuthorityReport(pages as FocusPage[], startUrl, sfs, { taxonomy: usable, embeddings, now: sfs.generatedAt }) : null),
    [pages, startUrl, sfs, usable, embeddings],
  );

  useEffect(() => {
    if (!report || !run || !validAuthorityProject(projectId)) return;
    const runId = usable ? `${run.id}:${usable.builtAt}` : run.id;
    const saved = recordAuthority(projectId, report, runId, pages.map((page) => page.url), { benchmark: pendingBenchmark });
    if (saved.saved) { setHistory(saved.entries); if (pendingBenchmark) setBenchmark(pendingBenchmark); }
    // One snapshot per run and reference map; deduped by runId in the history store.
  }, [report?.generatedAt, report?.tas, run?.id, projectId, pendingBenchmark]);

  const build = useCallback(async (options?: ReferenceRunOptions) => {
    if (!sfs) return;
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setState({ ...IDLE, running: true });
    try {
      const outcome = await runner({ report: sfs, startUrl, signal: own.signal, onProgress: (progress) => { if (!own.signal.aborted) setState((current) => ({ ...current, progress })); } }, options);
      if (controller.current !== own) return;
      if (outcome.status !== 'ok') { setState({ ...IDLE, failure: outcome }); return; }
      const where = market();
      const stamped: ReferenceTaxonomy = { ...outcome.taxonomy, market: where };
      writeTaxonomy(projectId, stamped);
      recordReferenceSnapshot(projectId ?? null, stamped, outcome.serp, where);
      const fresh = buildAuthorityReport(pages as FocusPage[], startUrl, sfs, { taxonomy: stamped, embeddings, now: sfs.generatedAt });
      setPendingBenchmark(withSerpEvidence(buildTopicalBenchmark(fresh, domainOf(startUrl), outcome.competitors, stamped, new Date().toISOString(), outcome.attempted), outcome.serp));
      setTaxonomy(stamped);
      setState(IDLE);
    } catch (error) {
      if (controller.current === own) setState({ ...IDLE, error: error instanceof Error ? error.message : String(error) });
    }
  }, [sfs, startUrl, pages, projectId, runner, market, embeddings]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => { clearTaxonomy(projectId); setTaxonomy(null); setBenchmark(null); setPendingBenchmark(null); }, [projectId]);

  return { report, taxonomy: usable, benchmark: pendingBenchmark ?? benchmark, history, state, build, cancel, clear };
};
