import { z } from 'zod';
import type { CruxReport, PageSpeedReport } from './pagespeed';

const text = z.string().nullable();
const measurement = z.number().finite().nonnegative().nullable();
const score = z.number().finite().min(0).max(1).nullable();
const count = z.number().finite().int().nonnegative();
const object = z.record(z.unknown());
const metric = z.object({
  id: z.string(), title: z.string(), displayValue: text, numericValue: measurement, score,
});
const audit = {
  id: z.string(), title: z.string(), description: z.string(), score,
  scoreDisplayMode: text, displayValue: text, evidenceCount: count, evidenceTruncated: z.boolean(),
};
const touchTarget = z.object({
  ...audit,
  evidence: z.array(z.object({
    label: text, selector: text, snippet: text, target: text,
    targetSize: z.unknown(), boundingRect: z.unknown(), failureSummary: text, explanation: text,
  }).transform((value) => ({ ...value, targetSize: value.targetSize, boundingRect: value.boundingRect }))),
});
const imageOptimization = z.object({
  ...audit,
  overallSavingsBytes: measurement,
  evidence: z.array(z.object({
    url: text, label: text, selector: text, snippet: text, totalBytes: measurement,
    wastedBytes: measurement, wastedPercent: z.number().finite().min(0).max(100).nullable(), displayValue: text,
  })),
});

// These schemas are also checked against the native report interfaces at build
// time. Missing evidence stays missing; validators never manufacture scores.
const pageSpeed: z.ZodType<PageSpeedReport, z.ZodTypeDef, unknown> = z.object({
  source: z.string(), requestedUrl: z.string(), finalUrl: z.string(), strategy: z.enum(['mobile', 'desktop']),
  fetchedAt: text, lighthouseVersion: text,
  categories: z.object({
    performance: z.number().finite().min(0).max(100).nullable(),
    accessibility: z.number().finite().min(0).max(100).nullable(),
    bestPractices: z.number().finite().min(0).max(100).nullable(),
    seo: z.number().finite().min(0).max(100).nullable(),
  }),
  metrics: z.record(metric),
  opportunities: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), displayValue: text, score })),
  touchTargetAudit: touchTarget.nullable().optional(),
  imageOptimizationAudits: z.array(imageOptimization).optional(),
  fieldExperience: object.nullable(), originExperience: object.nullable(),
});
const crux: z.ZodType<CruxReport> = z.object({
  source: z.string(), fetchedAt: z.string(), target: z.string(), scope: z.enum(['url', 'origin']),
  formFactor: z.enum(['PHONE', 'DESKTOP', 'TABLET']), response: object,
});

export const parsePageSpeedReport = (value: unknown): PageSpeedReport | null => {
  const result = pageSpeed.safeParse(value);
  return result.success ? result.data : null;
};

export const parseCruxReport = (value: unknown): CruxReport | null => {
  const result = crux.safeParse(value);
  return result.success ? result.data : null;
};
