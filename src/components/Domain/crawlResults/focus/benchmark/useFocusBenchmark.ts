import { useCallback, useEffect, useRef, useState } from 'react';
import { runBenchmark, createBenchmarkDeps, type BenchmarkInput, type BenchmarkOutcome, type BenchmarkProgress } from '@/services/siteFocusBenchmark';

export type BenchmarkRunner = (input: BenchmarkInput) => Promise<BenchmarkOutcome>;

export const defaultRunner: BenchmarkRunner = (input) => runBenchmark(createBenchmarkDeps(), input);

export interface BenchmarkState {
  running: boolean;
  progress: BenchmarkProgress | null;
  outcome: BenchmarkOutcome | null;
  error: string | null;
}

const IDLE: BenchmarkState = { running: false, progress: null, outcome: null, error: null };

export const useFocusBenchmark = (runner: BenchmarkRunner) => {
  const [state, setState] = useState<BenchmarkState>(IDLE);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(async (input: Omit<BenchmarkInput, 'signal' | 'onProgress'>) => {
    controller.current?.abort();
    const own = new AbortController();
    controller.current = own;
    setState({ ...IDLE, running: true });
    try {
      const outcome = await runner({ ...input, signal: own.signal, onProgress: (progress) => { if (!own.signal.aborted) setState((current) => ({ ...current, progress })); } });
      if (controller.current === own) setState({ ...IDLE, outcome });
    } catch (error) {
      if (controller.current === own) setState({ ...IDLE, error: error instanceof Error ? error.message : String(error) });
    }
  }, [runner]);

  const cancel = useCallback(() => controller.current?.abort(), []);
  return { state, start, cancel };
};
