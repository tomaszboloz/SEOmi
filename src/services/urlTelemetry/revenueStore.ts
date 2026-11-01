import { z } from 'zod';
import { readJsonStorage, removeStorage, writeJsonStorage } from '@/services/storage';
import { MAX_REVENUE_ROWS, REVENUE_ATTRIBUTION, type RevenueImport } from './revenue';
import { dropSnapshot } from './store';

export const revenueImportKey = (projectId: string): string => `seomi_project_${projectId}_revenue_import_v1`;

const schema: z.ZodType<RevenueImport> = z.object({
  provider: z.enum(['ga4-export', 'ga4-api']),
  attribution: z.literal(REVENUE_ATTRIBUTION),
  currency: z.string().regex(/^[A-Z]{3}$/u),
  organicOnly: z.literal(true),
  period: z.object({ start: z.iso.date(), end: z.iso.date() }).nullable(),
  sourceFile: z.string().max(200),
  importedAt: z.iso.datetime(),
  truncated: z.boolean(),
  rows: z.array(z.object({ landingPage: z.string().min(1), revenue: z.number().finite() })).min(1).max(MAX_REVENUE_ROWS),
});

/** Saving or forgetting an import invalidates the project's cached telemetry so the next read includes it. */
export const rememberRevenueImport = (projectId: string, data: RevenueImport): boolean => {
  const saved = writeJsonStorage(revenueImportKey(projectId), data);
  dropSnapshot(projectId);
  return saved;
};

export const recallRevenueImport = (projectId: string): RevenueImport | null => {
  const parsed = schema.safeParse(readJsonStorage(revenueImportKey(projectId), null));
  return parsed.success ? parsed.data : null;
};

export const forgetRevenueImport = (projectId: string): boolean => {
  dropSnapshot(projectId);
  return removeStorage(revenueImportKey(projectId));
};
