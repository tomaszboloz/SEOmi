/** Cost and savings counter for LLM calls. Local providers (Ollama, vLLM) cost nothing and send nothing out. */

export interface UsageEntry {
  /** Price the call would cost at the provider's rate (USD). Real figure from the provider, never guessed. */
  costUsd: number;
  /** Answered from the semantic cache: no call was made, `costUsd` is the saving. */
  cached: boolean;
  /** Ran on this device. */
  local: boolean;
}

export interface UsageSummary {
  spentUsd: number;
  savedUsd: number;
  cacheHits: number;
  calls: number;
  remainingUsd: number | null;
  overBudget: boolean;
  unknownCostCalls?: number;
}

const LOCAL_PROVIDERS = new Set(['ollama', 'vllm', 'lmstudio', 'llamacpp']);

export const isLocalProvider = (providerId: string): boolean => LOCAL_PROVIDERS.has(providerId.trim().toLowerCase());

/** Content leaves the device for every non-local provider; show a warning before batch runs. */
export const leavesDevice = (providerId: string): boolean => providerId.trim() !== '' && !isLocalProvider(providerId);

/** Default provider for batches: local when available, otherwise the first configured one. */
export const pickBatchProvider = (configured: string[], batchSize: number, threshold = 50): string | null => {
  if (configured.length === 0) return null;
  const local = configured.find(isLocalProvider);
  return batchSize >= threshold && local ? local : configured[0];
};

export const summarizeUsage = (entries: UsageEntry[], budgetUsd: number | null): UsageSummary => {
  const valid = entries.filter((entry) => Number.isFinite(entry.costUsd) && entry.costUsd >= 0);
  const spent = valid.filter((entry) => !entry.cached && !entry.local).reduce((sum, entry) => sum + entry.costUsd, 0);
  const saved = valid.filter((entry) => entry.cached || entry.local).reduce((sum, entry) => sum + entry.costUsd, 0);
  const hasBudget = budgetUsd !== null && Number.isFinite(budgetUsd) && budgetUsd >= 0;
  return {
    spentUsd: spent,
    savedUsd: saved,
    cacheHits: valid.filter((entry) => entry.cached).length,
    calls: valid.length,
    remainingUsd: hasBudget ? Math.max(0, budgetUsd - spent) : null,
    overBudget: hasBudget ? spent > budgetUsd : false,
  };
};

/** True when one more call of `nextCostUsd` would still fit the project budget. */
export const withinBudget = (entries: UsageEntry[], budgetUsd: number | null, nextCostUsd: number): boolean =>
  budgetUsd === null || summarizeUsage(entries, budgetUsd).spentUsd + nextCostUsd <= budgetUsd;
