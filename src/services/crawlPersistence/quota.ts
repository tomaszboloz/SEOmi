
export const crawlQuotaRetryCounts = (runCount: number): number[] => {
  const counts: number[] = [];
  let count = runCount;
  while (count > 1) {
    count = Math.max(1, Math.floor(count / 2));
    counts.push(count);
  }
  return counts;
};

export const isStorageQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  const quotaMessage = /quota|storage.*(?:full|limit)|disk.*full|no space left|not enough space|(?:exceed(?:s|ed|ing)?|przekracza|przekroczono).{0,64}limit/i;
  if (typeof error === 'string') return quotaMessage.test(error);
  if (typeof error !== 'object') return false;
  const quotaError = error as { name?: string; code?: number; message?: string };
  return quotaError.name === 'QuotaExceededError'
    || quotaError.code === 22
    || quotaError.code === 1014
    || quotaMessage.test(quotaError.message || '');
};
