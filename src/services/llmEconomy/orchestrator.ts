import { isLocalProvider, pickBatchProvider } from './costMeter';
import { validateYmylClaim, type YmylSourceInput } from './factGate';
import { recordLlmCost } from './llmBudget';
import { buildTaskKey, findProjectCachedTask, resolveCacheSavings, storeProjectTask } from './semanticCache';
import { shareInFlight } from './executionState';
import { reserveProjectBudget } from './budgetReservation';
export { IN_FLIGHT_TTL_MS, MAX_IN_FLIGHT } from './executionState';

export interface ExecuteOptions {
  projectId: string;
  configuredProviders: string[];
  providerId?: string;
  /** Actual adapter transport; cloud is required for local_cli-backed hosted IDs. */
  transport?: 'local' | 'cloud';
  model?: string;
  prompt: string;
  vector?: ArrayLike<number> | null;
  cacheThreshold?: number;
  batchSize?: number;
  batchThreshold?: number;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  ymyl?: boolean;
  sources?: YmylSourceInput[];
  run: (providerId: string) => Promise<{ text: string; actualCostUsd?: number | null; transport?: 'local' | 'cloud' }>;
  now?: Date;
}

export interface ExecutionResult {
  text: string;
  providerId: string;
  model: string;
  costUsd: number | null;
  savedUsd: number;
  cached: boolean;
  matchType?: 'exact' | 'semantic';
  local: boolean;
  leavesDevice: boolean;
  factGatePassed: boolean;
  rejectedClaims: string[];
  needsHumanApproval: boolean;
}

export class LlmFactGateBlockedError extends Error {
  readonly code = 'llm-fact-gate-blocked' as const;
  readonly factGatePassed = false;
  readonly needsHumanApproval = true;
  constructor(readonly rejectedClaims: string[]) {
    super(`YMYL fact gate rejected unsupported claims: ${rejectedClaims.join(', ')}`);
    this.name = 'LlmFactGateBlockedError';
  }
}

const validateCallerResult = (result: ExecutionResult, options: ExecuteOptions): ExecutionResult => {
  if (!options.ymyl) return result;
  if (!result.factGatePassed) return result;
  const check = validateYmylClaim(result.text, options.sources ?? []);
  if (!check.allowed) return { ...result, text: '', factGatePassed: false, rejectedClaims: check.rejectedValues, needsHumanApproval: true };
  return { ...result, factGatePassed: true, rejectedClaims: [], needsHumanApproval: true };
};

const blockedResult = (base: ExecutionResult, rejectedClaims: string[]): ExecutionResult => ({
  ...base, text: '', factGatePassed: false, rejectedClaims, needsHumanApproval: true,
});

export const executeWithEconomy = async (options: ExecuteOptions): Promise<ExecutionResult> => {
  const chosenProvider = options.providerId
    ?? (options.batchSize !== undefined ? pickBatchProvider(options.configuredProviders, options.batchSize, options.batchThreshold) : null)
    ?? options.configuredProviders[0]
    ?? '';
  if (!chosenProvider) throw new Error('No AI provider configured');

  const model = options.model ?? 'default';
  const key = `${options.projectId}\u0000${buildTaskKey(chosenProvider, model, options.prompt)}`;
  // Share provider work, but never share a caller's fact approval.
  return shareInFlight(key, () => executeWithEconomyUnshared(options, chosenProvider, model))
    .then((result) => validateCallerResult(result, options));
};

const executeWithEconomyUnshared = async (options: ExecuteOptions, chosenProvider: string, model: string): Promise<ExecutionResult> => {
  const local = isLocalProvider(chosenProvider);
  const transport = options.transport ?? (local ? 'local' : 'cloud');
  if (transport === 'local' && !local) throw new Error('Local AI transport requires a known local provider');
  const executesLocally = transport === 'local';
  const willLeave = transport === 'cloud';
  const now = options.now ?? new Date();

  // 1. Project-scoped cache: exact key lookup and cosine semantic lookup
  const hit = findProjectCachedTask(options.projectId, model, options.prompt, options.vector, options.cacheThreshold, chosenProvider, now.getTime());
  if (hit) {
    const savings = resolveCacheSavings(hit.record.costUsd);
    const ymylCheck = options.ymyl ? validateYmylClaim(hit.record.response, options.sources ?? []) : null;
    if (ymylCheck && !ymylCheck.allowed) {
      return blockedResult({
        text: '', providerId: chosenProvider, model, costUsd: 0, savedUsd: savings.savedUsd,
        cached: true, matchType: hit.matchType, local, leavesDevice: willLeave,
        factGatePassed: false, rejectedClaims: ymylCheck.rejectedValues, needsHumanApproval: true,
      }, ymylCheck.rejectedValues);
    }
    recordLlmCost(options.projectId, { providerId: chosenProvider, model, costUsd: 0, savedUsd: savings.savedUsd, cached: true, local: executesLocally }, now);
    return {
      text: hit.record.response, providerId: chosenProvider, model, costUsd: 0, savedUsd: savings.savedUsd,
      cached: true, matchType: hit.matchType, local: executesLocally, leavesDevice: willLeave,
      factGatePassed: ymylCheck ? ymylCheck.allowed : true,
      rejectedClaims: ymylCheck ? ymylCheck.rejectedValues : [],
      needsHumanApproval: Boolean(options.ymyl),
    };
  }

  const estimatedCost = executesLocally ? 0 : (options.estimatedCostUsd ?? options.actualCostUsd ?? null);
  const releaseBudget = reserveProjectBudget(options.projectId, executesLocally, estimatedCost, now);

  try {
    // 2. Cache miss: execute provider
    const executed = await options.run(chosenProvider);
  if (executed.transport && executed.transport !== transport) throw new Error('AI adapter transport contract mismatch');
  const text = executed.text;
  let costUsd: number | null;
  let savedUsd = 0;

  if (executesLocally) {
    costUsd = 0;
    savedUsd = executed.actualCostUsd ?? options.actualCostUsd ?? options.estimatedCostUsd ?? 0;
  } else {
    const observed = executed.actualCostUsd !== undefined ? executed.actualCostUsd
      : options.actualCostUsd !== undefined ? options.actualCostUsd
      : options.estimatedCostUsd !== undefined ? options.estimatedCostUsd
      : null;
    costUsd = observed !== null && Number.isFinite(observed) ? Math.max(0, observed) : null;
  }

  recordLlmCost(options.projectId, { providerId: chosenProvider, model, costUsd, savedUsd, cached: false, local: executesLocally }, now);

  const ymylCheck = options.ymyl ? validateYmylClaim(text, options.sources ?? []) : null;
  if (ymylCheck && !ymylCheck.allowed) {
    return blockedResult({
      text: '', providerId: chosenProvider, model, costUsd, savedUsd, cached: false, local: executesLocally,
      leavesDevice: willLeave, factGatePassed: false, rejectedClaims: ymylCheck.rejectedValues, needsHumanApproval: true,
    }, ymylCheck.rejectedValues);
  }
  storeProjectTask(options.projectId, chosenProvider, model, options.prompt, text, costUsd, options.vector, now.getTime());
  return {
    text, providerId: chosenProvider, model, costUsd, savedUsd, cached: false, local: executesLocally, leavesDevice: willLeave,
    factGatePassed: ymylCheck ? ymylCheck.allowed : true,
    rejectedClaims: ymylCheck ? ymylCheck.rejectedValues : [],
    needsHumanApproval: Boolean(options.ymyl),
  };
  } finally { releaseBudget(); }
};
