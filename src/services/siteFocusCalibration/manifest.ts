import { z as validator } from 'zod';
import type { FocusPage } from '@/services/siteFocus';
import { CALIBRATION_KINDS } from './types';

const label = validator.enum(['on-topic', 'borderline', 'off-topic']);
const entry = validator.object({
  id: validator.string().min(1).max(80),
  kind: validator.enum([...CALIBRATION_KINDS, 'other']),
  /** Persisted crawl run JSON (a saved CrawlRunRecord or `{ startUrl, pages }`), relative to the manifest. */
  file: validator.string().min(1),
  provenance: validator.object({
    source: validator.string(), consent: validator.boolean(), crawledAt: validator.string(), notes: validator.string().optional(),
  }),
  labels: validator.record(validator.string(), label).optional(),
  options: validator.object({
    manualTopic: validator.union([validator.string(), validator.array(validator.string())]).optional(),
    anchorUrls: validator.array(validator.string()).optional(),
    businessGoal: validator.string().optional(),
    language: validator.string().optional(),
    brand: validator.object({
      aliases: validator.array(validator.string()).optional(),
      competitors: validator.array(validator.string()).optional(),
      exceptions: validator.array(validator.string()).optional(),
    }).optional(),
  }).optional(),
});
const manifest = validator.object({ sites: validator.array(entry).min(1), scales: validator.array(validator.number().positive()).optional() });

export type CalibrationManifest = validator.infer<typeof manifest>;
export type ManifestEntry = CalibrationManifest['sites'][number];

/** Validates a calibration manifest; throws with the first problem instead of guessing missing fields. */
export const parseCalibrationManifest = (raw: unknown): CalibrationManifest => {
  const parsed = manifest.safeParse(raw);
  if (!parsed.success) throw new Error(`Invalid calibration manifest: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  return parsed.data;
};

/** Start URL and pages of a persisted crawl file in either supported shape. */
export const crawlInput = (raw: unknown): { startUrl: string; pages: FocusPage[] } => {
  const value = (raw ?? {}) as { startUrl?: unknown; start_url?: unknown; pages?: unknown; result?: { pages?: unknown } };
  const startUrl = typeof value.startUrl === 'string' ? value.startUrl : typeof value.start_url === 'string' ? value.start_url : '';
  const pages = Array.isArray(value.pages) ? value.pages : Array.isArray(value.result?.pages) ? value.result.pages : [];
  if (!startUrl) throw new Error('Crawl file has no startUrl');
  return { startUrl, pages: pages as FocusPage[] };
};
