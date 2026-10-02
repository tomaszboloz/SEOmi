import { BatchAuditItem, BatchAuditRun, AuditHistoryPersistResult } from './auditTypes';
import { PageAuditData } from '@/types';
import { createId } from '@/services/ids';
import i18n from '@/i18n';
import { isStorageQuotaError } from '@/services/crawlPersistence';
import { writeStorageResult } from '@/services/storage';
import { historyKey, auditRequestTokens } from './auditConstants';

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const parseBatchQueue = (value: unknown): BatchAuditItem[] => Array.isArray(value)
  ? value.filter((item): item is BatchAuditItem => Boolean(
    item && typeof item === 'object'
      && typeof (item as Partial<BatchAuditItem>).id === 'string'
      && typeof (item as Partial<BatchAuditItem>).url === 'string'
      && ['queued', 'running', 'interrupted', 'completed', 'failed'].includes((item as Partial<BatchAuditItem>).status || ''),
  ))
  : [];

export const parseBatchRun = (value: unknown): BatchAuditRun | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BatchAuditRun>;
  if (typeof candidate.id !== 'string' || typeof candidate.startedAt !== 'string' || typeof candidate.updatedAt !== 'string') return null;
  if (!['running', 'interrupted', 'stopped', 'completed'].includes(candidate.status || '')) return null;
  return candidate as BatchAuditRun;
};

export const recoverInterruptedBatch = (items: BatchAuditItem[], run: BatchAuditRun | null): { items: BatchAuditItem[]; run: BatchAuditRun | null; changed: boolean } => {
  const hasRunningItem = items.some((item) => item.status === 'running');
  if (!(run?.status === 'running' || hasRunningItem)) return { items, run, changed: false };
  const interruptedAt = new Date().toISOString();
  const recoveredItems = items.map((item) => item.status === 'running'
    ? { ...item, status: 'interrupted' as const, updatedAt: interruptedAt, error: i18n.t('runtimeErrors.audit.batchInterrupted') }
    : item);
  const recoveredRun = run
    ? { ...run, status: 'interrupted' as const, updatedAt: interruptedAt, stopRequested: false }
    : { id: createId('batch-run'), status: 'interrupted' as const, startedAt: interruptedAt, updatedAt: interruptedAt };
  return { items: recoveredItems, run: recoveredRun, changed: true };
};

export const auditHostname = (audit: PageAuditData | null): string | null => {
  if (!audit) return null;
  try {
    const hostname = new URL(audit.final_url || audit.url).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
};

export const beginAuditRequest = (kind: string): string => {
  const token = createId(`audit-${kind}`);
  auditRequestTokens.set(kind, token);
  return token;
};

export const isLatestAuditRequest = (kind: string, token: string): boolean => auditRequestTokens.get(kind) === token;

export const formatAuditRuntimeError = (error: unknown): string => {
  if (isStorageQuotaError(error)) return i18n.t('runtimeErrors.persistence.localQuota');
  return error instanceof Error ? error.message : i18n.t('runtimeErrors.audit.historySave');
};

export const formatQueueWakeupError = (error: unknown): string => i18n.t('schedules.schedulerError', {
  error: error instanceof Error ? error.message : String(error),
});

export const compactAuditForHistory = (audit: PageAuditData, level: 1 | 2): PageAuditData => {
  const cloned = JSON.parse(JSON.stringify(audit)) as PageAuditData;
  const listLimit = level === 1 ? 40 : 8;
  const issueLimit = level === 1 ? 80 : 16;
  cloned.images = cloned.images.slice(0, listLimit);
  cloned.links = { ...cloned.links, links: cloned.links.links.slice(0, listLimit) };
  cloned.issues = cloned.issues.slice(0, issueLimit);
  cloned.structured_data = cloned.structured_data.slice(0, level === 1 ? 20 : 4);
  cloned.meta_tags = { ...cloned.meta_tags, other_tags: cloned.meta_tags.other_tags.slice(0, listLimit) };
  cloned.open_graph = { ...cloned.open_graph, all_tags: cloned.open_graph.all_tags.slice(0, listLimit) };
  cloned.twitter_card = { ...cloned.twitter_card, all_tags: cloned.twitter_card.all_tags.slice(0, listLimit) };
  if (cloned.accessibility) {
    cloned.accessibility = {
      ...cloned.accessibility,
      findings: cloned.accessibility.findings?.slice(0, issueLimit),
      manual_review_items: cloned.accessibility.manual_review_items.slice(0, issueLimit),
    };
  }
  if (cloned.content_stats) {
    cloned.content_stats = { ...cloned.content_stats, body_text: undefined };
  }
  if (cloned.amp) cloned.amp = { ...cloned.amp, amphtml_urls: cloned.amp.amphtml_urls.slice(0, listLimit), findings: cloned.amp.findings.slice(0, issueLimit), unchecked: cloned.amp.unchecked.slice(0, issueLimit) };
  if (cloned.technical) cloned.technical = { ...cloned.technical, hreflang_tags: cloned.technical.hreflang_tags.slice(0, listLimit), favicons: cloned.technical.favicons?.slice(0, listLimit), technology_signals: cloned.technical.technology_signals?.slice(0, listLimit) };
  return cloned;
};

export const persistAuditHistory = (projectId: string, history: PageAuditData[]): AuditHistoryPersistResult => {
  const candidates: Array<{ history: PageAuditData[]; compacted: boolean }> = [
    { history, compacted: false },
    { history: history.slice(0, 8), compacted: true },
    { history: history.slice(0, 1).map((audit) => compactAuditForHistory(audit, 1)), compacted: true },
    { history: history.slice(0, 1).map((audit) => compactAuditForHistory(audit, 2)), compacted: true },
  ];
  let quota = false;
  for (const candidate of candidates) {
    let serialized: string;
    try {
      serialized = JSON.stringify(candidate.history);
    } catch {
      continue;
    }
    const result = writeStorageResult(historyKey(projectId), serialized);
    if (result.ok) return { saved: true, compacted: candidate.compacted, quota };
    quota ||= isStorageQuotaError(result.error);
  }
  return { saved: false, compacted: false, quota };
};

export const batchSnapshotFingerprint = (items: BatchAuditItem[], run: BatchAuditRun | null): string => [
  ...items.map((item) => `${item.id}:${item.status}:${item.updatedAt || ''}:${item.attempts || 0}`),
  run ? `${run.id}:${run.status}:${run.updatedAt}:${run.activeItemId || ''}` : '',
].join('|');
