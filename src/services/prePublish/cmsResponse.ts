import type { PrePublishReport } from './check';
import { CMS_CONTRACT_VERSION, type CmsCheckRequest, type CmsContractError } from './cmsContract';
import type { PrePublishPolicy } from './policy';

/**
 * Versioned CMS pre-publish response (ADR 0004, #95). It echoes the revision and content hash it was computed
 * for, so an adapter can refuse a stale green report. The draft body is never echoed back.
 */
export const CMS_RESPONSE_TTL_MS = 15 * 60_000;

export interface CmsCheckResponse {
  schemaVersion: typeof CMS_CONTRACT_VERSION;
  requestId: string | null;
  projectId: string | null;
  revision: string | null;
  contentHash: string | null;
  status: 'checked' | 'rejected' | 'unavailable';
  /** Decision (default chosen by agent): what the adapter does with this response. */
  action: 'allow-with-advice' | 'allow' | 'hold';
  report: {
    verdict: PrePublishReport['verdict'];
    publishApproved: boolean;
    reasons: string[];
    evidenceGaps: string[];
    sfsDelta: number | null;
    conflicts: Array<{ url: string; similarity: number; level: 'conflict' | 'overlap' }>;
    donors: Array<{ url: string; similarity: number; trs: number }>;
    weakPassages: Array<{ start: number; end: number; issues: string[] }>;
  } | null;
  errors: Array<CmsContractError | 'engine-unavailable'>;
  provenance: { engine: 'seomi-prepublish'; engineVersion: 1; baselineRunId: string | null; baselineCompletedAt: string | null };
  checkedAt: string;
  expiresAt: string;
}

interface Baseline { runId: string | null; completedAt: string | null }

const envelope = (request: Partial<CmsCheckRequest> | null, baseline: Baseline, now: Date) => ({
  schemaVersion: CMS_CONTRACT_VERSION, requestId: request?.requestId ?? null, projectId: request?.projectId ?? null,
  revision: request?.revision ?? null, contentHash: request?.contentHash ?? null,
  provenance: { engine: 'seomi-prepublish' as const, engineVersion: 1 as const, baselineRunId: baseline.runId, baselineCompletedAt: baseline.completedAt },
  checkedAt: now.toISOString(), expiresAt: new Date(now.getTime() + CMS_RESPONSE_TTL_MS).toISOString(),
});

/**
 * Failure policy. Decision (default chosen by agent): advisory fails open with a visible warning (the editor
 * may publish, nothing is approved); enforced fails closed (hold for a human). A rejected payload always holds.
 */
const failureAction = (policy: PrePublishPolicy | undefined): CmsCheckResponse['action'] => (policy === 'advisory' ? 'allow-with-advice' : 'hold');

export const cmsRejected = (error: CmsContractError, baseline: Baseline, now = new Date()): CmsCheckResponse => ({
  ...envelope(null, baseline, now), status: 'rejected', action: 'hold', report: null, errors: [error],
});

export const cmsUnavailable = (request: CmsCheckRequest, baseline: Baseline, now = new Date()): CmsCheckResponse => ({
  ...envelope(request, baseline, now), status: 'unavailable', action: failureAction(request.policy), report: null, errors: ['engine-unavailable'],
});

export const cmsChecked = (request: CmsCheckRequest, report: PrePublishReport, baseline: Baseline, now = new Date()): CmsCheckResponse => ({
  ...envelope(request, baseline, now), status: 'checked', errors: [],
  action: request.policy === 'advisory' ? 'allow-with-advice' : report.gate === 'pass' && report.publishApproved ? 'allow' : 'hold',
  report: {
    verdict: report.verdict, publishApproved: report.publishApproved, reasons: [...report.reasons], evidenceGaps: [...(report.evidenceGaps ?? [])],
    sfsDelta: report.sfsDelta, conflicts: report.conflicts.map((conflict) => ({ ...conflict })),
    donors: (report.donors ?? []).map(({ url, similarity, trs }) => ({ url, similarity, trs })),
    weakPassages: (report.chunkDetails?.chunks ?? []).filter((chunk) => chunk.weak).map(({ start, end, issues }) => ({ start, end, issues: [...issues] })),
  },
});

/** A response is usable only for the same revision and content, before it expires (publish-vs-check race). */
export const isCmsResponseCurrent = (response: CmsCheckResponse, revision: string, contentHash: string, now = new Date()): boolean =>
  response.status === 'checked' && response.revision === revision && response.contentHash === contentHash && Date.parse(response.expiresAt) > now.getTime();
