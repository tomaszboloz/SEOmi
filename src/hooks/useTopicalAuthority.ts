import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CrawlRunRecord, CrawledPageSummary } from '@/types';
import type { FocusPage, SiteFocusReport } from '@/services/siteFocus';
import { buildAuthorityReport, type ReferenceTaxonomy, type TopicalAuthorityReport } from '@/services/topicalAuthority';
import {
  readAuthorityHistory, readTaxonomy, readTopicalBenchmark, recordAuthority, validAuthorityProject, writeTaxonomy, clearTaxonomy,
  type AuthorityHistoryEntry,
} from '@/services/topicalAuthorityMonitoring';
import {
  buildTopicalBenchmark, createReferenceDeps, referenceMarket, runReference,
  type ReferenceInput, type ReferenceOutcome, type ReferenceProgress, type TopicalBenchmark,
} from '@/services/topicalAuthorityReference';

import { recordReferenceSnapshot } from '@/services/semanticDecay/recordReferenceSnapshot';

export type ReferenceRunner = (input: ReferenceInput) => Promise<ReferenceOutcome>;
export const defaultReferenceRunner: ReferenceRunner = (input) => runReference(createReferenceDeps(), input);

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

  const report = useMemo<TopicalAuthorityReport | null>(
    () => (sfs ? buildAuthorityReport(pages as FocusPage[], startUrl, sfs, { taxonomy, now: sfs.generatedAt }) : null),
    [pages, startUrl, sfs, taxonomy],
  );

  useEffect(() => {
    if (!report || !run || !validAuthorityProject(projectId)) return;
    const runId = taxonomy ? `${run.id}:${taxonomy.builtAt}` : run.id;
    const saved = recordAuthority(projectId, report, runId, pages.map((page) => page.url), { benchmark: pendingBenchmark });
    if (saved.saved) { setHistory(saved.entries); if (pendingBenchmark) setBenchmark(pendingBenchmark); }
    // One snapshot per run and reference map; deduped by runId in the history store.
  }, [report?.generatedAt, report?.tas, run?.id, projectId, pendingBenchmark]);

  const build = useCallback(async () => {
    if (!sfs) return;
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setState({ ...IDLE, running: true });
    try {
      const outcome = await runner({ report: sfs, startUrl, signal: own.signal, onProgress: (progress) => { if (!own.signal.aborted) setState((current) => ({ ...current, progress })); } });
      if (controller.current !== own) return;
      if (outcome.status !== 'ok') { setState({ ...IDLE, failure: outcome }); return; }
      writeTaxonomy(projectId, outcome.taxonomy);
      recordReferenceSnapshot(projectId ?? null, outcome.taxonomy, outcome.serp, market());      const fresh = buildAuthorityReport(pages as FocusPage[], startUrl, sfs, { taxonomy: outcome.taxonomy, now: sfs.generatedAt });
      setPendingBenchmark(buildTopicalBenchmark(fresh, domainOf(startUrl), outcome.competitors, outcome.taxonomy, new Date().toISOString()));
      setTaxonomy(outcome.taxonomy);
      setState(IDLE);
    } catch (error) {
      if (controller.current === own) setState({ ...IDLE, error: error instanceof Error ? error.message : String(error) });
    }
  }, [sfs, startUrl, pages, projectId, runner, market]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => { clearTaxonomy(projectId); setTaxonomy(null); setBenchmark(null); setPendingBenchmark(null); }, [projectId]);

  return { report, taxonomy, benchmark: pendingBenchmark ?? benchmark, history, state, build, cancel, clear };
};
