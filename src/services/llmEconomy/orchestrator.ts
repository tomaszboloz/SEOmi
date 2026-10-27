import { isLocalProvider, leavesDevice, pickBatchProvider } from './costMeter';
import { validateYmylClaim } from './factGate';
import { readLlmBudget, recordLlmCost, withinProjectBudget } from './llmBudget';
import { findProjectCachedTask, resolveCacheSavings, storeProjectTask } from './semanticCache';

export interface ExecuteOptions {
  projectId: string;
  configuredProviders: string[];
  providerId?: string;
  model?: string;
  prompt: string;
  vector?: ArrayLike<number> | null;
  cacheThreshold?: number;
  batchSize?: number;
  batchThreshold?: number;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  ymyl?: boolean;
  sources?: string[];
  run: (providerId: string) => Promise<{ text: string; actualCostUsd?: number | null }>;
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

export const executeWithEconomy = async (options: ExecuteOptions): Promise<ExecutionResult> => {
  const chosenProvider = options.providerId
    ?? (options.batchSize !== undefined ? pickBatchProvider(options.configuredProviders, options.batchSize, options.batchThreshold) : null)
    ?? options.configuredProviders[0]
    ?? '';
  if (!chosenProvider) throw new Error('No AI provider configured');

  const model = options.model ?? 'default';
  const local = isLocalProvider(chosenProvider);
  const willLeave = leavesDevice(chosenProvider);
  const now = options.now ?? new Date();

  // Active budget limit cannot be bypassed by unpriced external calls
  const budget = readLlmBudget(options.projectId);
  const estimatedCost = local ? 0 : (options.estimatedCostUsd ?? options.actualCostUsd ?? null);
  if (budget.monthlyLimitUsd !== null) {
    if (estimatedCost === null) throw new Error('Cannot execute unpriced external LLM call under active project budget limit');
    if (!withinProjectBudget(options.projectId, estimatedCost, now)) throw new Error('Project LLM budget exceeded');
  }

  // 1. Project-scoped cache: exact key lookup and cosine semantic lookup
  const hit = findProjectCachedTask(options.projectId, model, options.prompt, options.vector, options.cacheThreshold);
  if (hit) {
    const savings = resolveCacheSavings(hit.record.costUsd);
    recordLlmCost(options.projectId, { providerId: chosenProvider, model, costUsd: 0, savedUsd: savings.savedUsd, cached: true, local }, now);
    const ymylCheck = options.ymyl ? validateYmylClaim(hit.record.response, options.sources ?? []) : null;
    return {
      text: hit.record.response, providerId: chosenProvider, model, costUsd: 0, savedUsd: savings.savedUsd,
      cached: true, matchType: hit.matchType, local, leavesDevice: willLeave,
      factGatePassed: ymylCheck ? ymylCheck.allowed : true,
      rejectedClaims: ymylCheck ? ymylCheck.rejectedValues : [],
      needsHumanApproval: Boolean(options.ymyl),
    };
  }

  // 2. Cache miss: execute provider
  const executed = await options.run(chosenProvider);
  const text = executed.text;
  let costUsd: number | null;
  let savedUsd = 0;

  if (local) {
    costUsd = 0;
    savedUsd = executed.actualCostUsd ?? options.actualCostUsd ?? options.estimatedCostUsd ?? 0;
  } else {
    const observed = executed.actualCostUsd !== undefined ? executed.actualCostUsd
      : options.actualCostUsd !== undefined ? options.actualCostUsd
      : options.estimatedCostUsd !== undefined ? options.estimatedCostUsd
      : null;
    costUsd = observed !== null && Number.isFinite(observed) ? Math.max(0, observed) : null;
  }

  storeProjectTask(options.projectId, chosenProvider, model, options.prompt, text, costUsd, options.vector, now.getTime());
  recordLlmCost(options.projectId, { providerId: chosenProvider, model, costUsd, savedUsd, cached: false, local }, now);

  const ymylCheck = options.ymyl ? validateYmylClaim(text, options.sources ?? []) : null;
  return {
    text, providerId: chosenProvider, model, costUsd, savedUsd, cached: false, local, leavesDevice: willLeave,
    factGatePassed: ymylCheck ? ymylCheck.allowed : true,
    rejectedClaims: ymylCheck ? ymylCheck.rejectedValues : [],
    needsHumanApproval: Boolean(options.ymyl),
  };
};
