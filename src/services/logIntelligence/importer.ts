import { verifyBot, type BotFamily, type BotStatus, type BotVerdict, type VerifyDeps } from './botVerify';
import { parseLogLine, type ParseOptions } from './parseLine';

/** Aggregates for one path, bot family and verification status. Raw IPs are never stored. */
export interface UrlBotAgg {
  path: string;
  family: BotFamily;
  status: BotStatus;
  hits: number;
  statusGroups: Record<'2xx' | '3xx' | '4xx' | '5xx', number>;
  latencySumMs: number;
  latencyCount: number;
  bytes: number;
  firstAt: number;
  lastAt: number;
  intervalSumMs: number;
  intervalCount: number;
  maxIntervalMs: number;
}

export interface LogImportState {
  /** Fully imported files; the same hash again is a rotated or compressed duplicate. */
  fileHashes: string[];
  /** Resume point inside an unfinished file. */
  inProgress: { hash: string; offset: number } | null;
  lines: number;
  malformed: number;
  ignoredNonBot: number;
  firstAt: number | null;
  lastAt: number | null;
  /** Days (UTC) that had at least one line; a gap is a missing day inside the period. */
  days: string[];
  aggs: Record<string, UrlBotAgg>;
}

export const emptyImportState = (): LogImportState => ({
  fileHashes: [], inProgress: null, lines: 0, malformed: 0, ignoredNonBot: 0, firstAt: null, lastAt: null, days: [], aggs: {},
});

export interface ImportInput {
  lines: Iterable<string> | AsyncIterable<string>;
  fileHash: string;
  state?: LogImportState;
  parse?: ParseOptions;
  verify?: VerifyDeps;
  /** Checked between lines; true stops and leaves a resume point. */
  shouldCancel?: () => boolean;
  onProgress?: (state: Readonly<LogImportState>) => void;
}

const group = (status: number): keyof UrlBotAgg['statusGroups'] | null => (status >= 200 && status < 300 ? '2xx' : status >= 300 && status < 400 ? '3xx' : status >= 400 && status < 500 ? '4xx' : status >= 500 && status < 600 ? '5xx' : null);

const MAX_IP_CACHE = 10_000;

/** Streams lines once, keeping only bounded aggregates. Returns a new state; the input state is not mutated. */
export const importAccessLog = async (input: ImportInput): Promise<LogImportState> => {
  const base = input.state ?? emptyImportState();
  const state: LogImportState = { ...base, aggs: { ...base.aggs }, days: [...base.days], fileHashes: [...base.fileHashes] };
  if (state.fileHashes.includes(input.fileHash)) return state;
  const skip = state.inProgress?.hash === input.fileHash ? state.inProgress.offset : 0;
  const days = new Set(state.days);
  const cache = new Map<string, BotVerdict>();
  let offset = 0;
  for await (const line of input.lines) {
    offset += 1;
    if (input.shouldCancel?.()) {
      state.inProgress = { hash: input.fileHash, offset: Math.max(skip, offset - 1) };
      state.days = [...days];
      input.onProgress?.(state);
      return state;
    }
    if (offset <= skip) continue;
    if (offset === 1 || offset % 500 === 0) input.onProgress?.(state);
    state.lines += 1;
    const hit = parseLogLine(line, input.parse);
    if (!hit) { state.malformed += 1; continue; }
    state.firstAt = state.firstAt === null ? hit.at : Math.min(state.firstAt, hit.at);
    state.lastAt = state.lastAt === null ? hit.at : Math.max(state.lastAt, hit.at);
    days.add(new Date(hit.at).toISOString().slice(0, 10));
    const key = `${hit.ip}|${hit.userAgent}`;
    let verdict = cache.get(key);
    if (!verdict) {
      verdict = await verifyBot(hit.ip, hit.userAgent, input.verify);
      if (cache.size >= MAX_IP_CACHE) cache.clear();
      cache.set(key, verdict);
    }
    const g = group(hit.status);
    if (!verdict.family || !g) { state.ignoredNonBot += 1; continue; }
    const id = `${hit.path}|${verdict.family}|${verdict.status}`;
    const prev = state.aggs[id];
    const gap = prev ? Math.abs(hit.at - prev.lastAt) : 0;
    state.aggs[id] = {
      path: hit.path, family: verdict.family, status: verdict.status, hits: (prev?.hits ?? 0) + 1,
      statusGroups: { ...(prev?.statusGroups ?? { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 }), [g]: (prev?.statusGroups[g] ?? 0) + 1 },
      latencySumMs: (prev?.latencySumMs ?? 0) + (hit.latencyMs ?? 0), latencyCount: (prev?.latencyCount ?? 0) + (hit.latencyMs === null ? 0 : 1),
      bytes: (prev?.bytes ?? 0) + (hit.bytes ?? 0), firstAt: Math.min(prev?.firstAt ?? hit.at, hit.at), lastAt: Math.max(prev?.lastAt ?? hit.at, hit.at),
      intervalSumMs: (prev?.intervalSumMs ?? 0) + gap, intervalCount: (prev?.intervalCount ?? 0) + (prev ? 1 : 0), maxIntervalMs: Math.max(prev?.maxIntervalMs ?? 0, gap),
    };
  }
  if (input.shouldCancel?.()) {
    state.inProgress = { hash: input.fileHash, offset: Math.max(skip, offset) };
    state.days = [...days];
    input.onProgress?.(state);
    return state;
  }
  state.fileHashes.push(input.fileHash);
  state.inProgress = null;
  state.days = [...days].sort();
  input.onProgress?.(state);
  return state;
};
