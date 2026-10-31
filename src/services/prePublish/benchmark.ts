/**
 * Cold/warm benchmark harness for the Pre-Publish check (#94 GEM-94-09).
 * The 2 s figure is a measured target on described hardware, never an SLA:
 * results carry the corpus size, provider and environment they were taken on.
 */
export const PREPUBLISH_TARGET_MS = 2000;
export const PREPUBLISH_WARM_RUNS = 5;

export interface BenchmarkEnvironment {
  platform: string;
  cpu: string;
  cores: number | null;
  memoryGb: number | null;
  runtime: string;
}

export interface PrePublishBenchmark {
  corpusPages: number;
  provider: string;
  coldMs: number;
  warmMs: number[];
  warmMedianMs: number | null;
  warmP95Ms: number | null;
  targetMs: number;
  coldWithinTarget: boolean;
  warmWithinTarget: boolean | null;
  environment: BenchmarkEnvironment;
  kind: 'benchmark-not-sla';
}

export interface BenchmarkOptions {
  corpusPages: number;
  provider: string;
  environment: BenchmarkEnvironment;
  warmRuns?: number;
  clock?: () => number;
  signal?: AbortSignal;
}

const round = (value: number): number => Math.round(value * 10) / 10;

/** Nearest-rank percentile of an ascending list; null for an empty list. */
export const percentile = (sorted: number[], p: number): number | null =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : null;

/** Runs `check` once cold, then `warmRuns` times warm; a failing run aborts the benchmark. */
export const benchmarkPrePublish = async (check: () => Promise<unknown>, options: BenchmarkOptions): Promise<PrePublishBenchmark> => {
  const clock = options.clock ?? (() => performance.now());
  const warmRuns = Math.max(0, Math.floor(options.warmRuns ?? PREPUBLISH_WARM_RUNS));
  if (!Number.isInteger(options.corpusPages) || options.corpusPages < 0) throw new Error('Invalid corpus size');
  const timed = async (): Promise<number> => {
    options.signal?.throwIfAborted();
    const start = clock();
    await check();
    return round(clock() - start);
  };
  const coldMs = await timed();
  const warmMs: number[] = [];
  for (let run = 0; run < warmRuns; run += 1) warmMs.push(await timed());
  const sorted = [...warmMs].sort((left, right) => left - right);
  const warmMedianMs = percentile(sorted, 50);
  const warmP95Ms = percentile(sorted, 95);
  return {
    corpusPages: options.corpusPages, provider: options.provider, coldMs, warmMs, warmMedianMs, warmP95Ms,
    targetMs: PREPUBLISH_TARGET_MS, coldWithinTarget: coldMs < PREPUBLISH_TARGET_MS,
    warmWithinTarget: warmP95Ms === null ? null : warmP95Ms < PREPUBLISH_TARGET_MS,
    environment: options.environment, kind: 'benchmark-not-sla',
  };
};

const yesNo = (value: boolean | null): string => (value === null ? 'n/a' : value ? 'yes' : 'no');

/** Markdown row set for attaching a measurement to the issue; English, developer-facing. */
export const benchmarkMarkdown = (results: PrePublishBenchmark[]): string => [
  '| Pages | Provider | Cold ms | Warm median ms | Warm p95 ms | Cold < 2 s | Warm p95 < 2 s |',
  '| ---: | --- | ---: | ---: | ---: | --- | --- |',
  ...results.map((result) => `| ${result.corpusPages} | ${result.provider} | ${result.coldMs} | ${result.warmMedianMs ?? 'n/a'} | ${result.warmP95Ms ?? 'n/a'} | ${yesNo(result.coldWithinTarget)} | ${yesNo(result.warmWithinTarget)} |`),
  '',
  ...[...new Map(results.map((result) => [JSON.stringify(result.environment), result.environment])).values()].map((env) =>
    `Environment: ${env.platform}, ${env.cpu}, ${env.cores ?? '?'} cores, ${env.memoryGb ?? '?'} GB RAM, ${env.runtime}. Benchmark, not an SLA.`),
].join('\n');
