import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import type { TopicalBenchmark } from '@/services/topicalAuthorityReference';
import { authorityBenchmarkKey, validAuthorityProject } from './keys';

const isBenchmark = (value: unknown): value is TopicalBenchmark => {
  const item = value as Partial<TopicalBenchmark> | null;
  return Boolean(item) && typeof item === 'object' && typeof item?.builtAt === 'string' && Array.isArray(item.rows) && Array.isArray(item.pillars) && Array.isArray(item.insights);
};

/** Last Topical Gap Matrix of the project; the basis for Competitor Radar alerts. */
export const readTopicalBenchmark = (projectId: string | null | undefined): TopicalBenchmark | null => {
  if (!validAuthorityProject(projectId)) return null;
  const raw = readJsonStorage(authorityBenchmarkKey(projectId), null);
  return isBenchmark(raw) ? raw : null;
};

export const writeTopicalBenchmark = (projectId: string | null | undefined, benchmark: TopicalBenchmark): boolean =>
  validAuthorityProject(projectId) ? writeJsonStorage(authorityBenchmarkKey(projectId), benchmark) : false;
