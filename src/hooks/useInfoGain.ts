import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readIgosHistory, readIgosReport, runInfoGain, saveIgos, validIgosProject,
  type InfoGainInput, type InfoGainOutcome, type IgosSnapshot, type SiteIgos,
} from '@/services/informationGain';
import { createBenchmarkDeps } from '@/services/siteFocusBenchmark';

export type InfoGainRunner = (input: InfoGainInput) => Promise<InfoGainOutcome>;
export type InfoGainProgress = NonNullable<Parameters<NonNullable<InfoGainInput['onProgress']>>[0]>;

export const defaultInfoGainRunner: InfoGainRunner = (input) => runInfoGain(createBenchmarkDeps(), input);

export interface InfoGainState {
  running: boolean;
  progress: InfoGainProgress | null;
  /** Latest finished or stored analysis. */
  report: SiteIgos | null;
  /** The stored report belongs to a different crawl run than the one on screen. */
  stale: boolean;
  history: IgosSnapshot[];
  failure: Extract<InfoGainOutcome, { status: 'unavailable' }> | null;
  error: string | null;
  cancelled: boolean;
}

export interface InfoGainStart extends Omit<InfoGainInput, 'signal' | 'onProgress'> { runId?: string }

/** Information Gain & Originality for a crawl run: stored report, per-run history and a cancellable analysis. */
export const useInfoGain = (projectId: string | null | undefined, runId: string | undefined, runner: InfoGainRunner = defaultInfoGainRunner) => {
  const load = () => (validIgosProject(projectId) ? readIgosReport(projectId) : null);
  const [stored, setStored] = useState(load);
  const [history, setHistory] = useState<IgosSnapshot[]>(() => readIgosHistory(projectId));
  const [state, setState] = useState({ running: false, progress: null as InfoGainProgress | null, failure: null as InfoGainState['failure'], error: null as string | null, cancelled: false });
  const [fresh, setFresh] = useState<SiteIgos | null>(null);
  const [scope, setScope] = useState(projectId);
  const controller = useRef<AbortController | null>(null);

  if (scope !== projectId) {
    setScope(projectId);
    setStored(load());
    setHistory(readIgosHistory(projectId));
    setFresh(null);
  }
  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(async (input: InfoGainStart) => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setState({ running: true, progress: null, failure: null, error: null, cancelled: false });
    try {
      const outcome = await runner({ ...input, signal: own.signal, onProgress: (progress) => { if (!own.signal.aborted) setState((current) => ({ ...current, progress })); } });
      if (controller.current !== own) return;
      const idle = { running: false, progress: null, failure: null, error: null, cancelled: false };
      if (outcome.status === 'ok') {
        setFresh(outcome.report);
        if (validIgosProject(projectId)) {
          const saved = saveIgos(projectId, outcome.report, input.runId ?? `manual:${outcome.report.generatedAt}`);
          setHistory(saved.history);
          setStored(readIgosReport(projectId));
        }
        setState(idle);
      } else setState({ ...idle, failure: outcome.status === 'unavailable' ? outcome : null, cancelled: outcome.status === 'cancelled' });
    } catch (error) {
      if (controller.current === own) setState({ running: false, progress: null, failure: null, cancelled: false, error: error instanceof Error ? error.message : String(error) });
    }
  }, [runner, projectId]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  const report = fresh ?? stored?.report ?? null;
  const stale = !fresh && Boolean(stored) && stored?.runId !== runId;
  return { state: { ...state, report, stale, history } as InfoGainState, start, cancel };
};
