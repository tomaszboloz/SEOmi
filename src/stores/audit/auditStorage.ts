import { readStorage, writeStorage, removeStorage } from '@/services/storage';
import { useProjectStore } from '@/stores/projectStore';
import { PageAuditData, TabType } from '@/types';
import { DataForSEOBacklinkSummary, DataForSEOSerpItem } from '@/types';
import { BatchAuditItem, BatchAuditRun } from './auditTypes';
import {
  ACTIVE_PROJECT_KEY,
  activeTabKey,
  historyKey,
  batchQueueKey,
  batchRunKey,
  dataForSeoSummaryKey,
  dataForSeoSerpKey,
  dataForSeoTargetKey,
  projectTabs,
} from './auditConstants';
import { parseBatchQueue, parseBatchRun, isFiniteNumber } from './auditHelpers';

export const activeProjectId = (): string | null => readStorage(ACTIVE_PROJECT_KEY) || useProjectStore.getState().activeProjectId;

export const readActiveTab = (projectId: string): TabType => {
  try {
    const value = readStorage(activeTabKey(projectId));
    return projectTabs.includes(value as TabType) ? value as TabType : 'overview';
  } catch {
    return 'overview';
  }
};

export const readHistory = (projectId: string): PageAuditData[] => {
  try {
    const value = JSON.parse(readStorage(historyKey(projectId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const readBatchQueue = (projectId: string): BatchAuditItem[] => {
  try { return parseBatchQueue(JSON.parse(readStorage(batchQueueKey(projectId)) || '[]')); } catch { return []; }
};

export const readBatchRun = (projectId: string): BatchAuditRun | null => {
  try { return parseBatchRun(JSON.parse(readStorage(batchRunKey(projectId)) || 'null')); } catch { return null; }
};

export const writeBatchRun = (projectId: string, run: BatchAuditRun | null): void => {
  try {
    if (run) writeStorage(batchRunKey(projectId), JSON.stringify(run));
    else removeStorage(batchRunKey(projectId));
  } catch {
    // The queue remains usable in memory when a locked-down WebView rejects storage.
  }
};

export const readDataForSeoSummary = (projectId: string): DataForSEOBacklinkSummary | null => {
  try {
    const value: unknown = JSON.parse(readStorage(dataForSeoSummaryKey(projectId)) || 'null');
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<DataForSEOBacklinkSummary>;
    if (typeof candidate.target !== 'string' || !candidate.target.trim()) return null;
    const numericFields: Array<keyof Omit<DataForSEOBacklinkSummary, 'target'>> = [
      'total_backlinks', 'referring_domains', 'referring_main_domains', 'rank', 'dofollow_backlinks', 'broken_backlinks',
    ];
    return numericFields.every((field) => field === 'dofollow_backlinks' && candidate[field] === null || isFiniteNumber(candidate[field])) ? value as DataForSEOBacklinkSummary : null;
  } catch {
    return null;
  }
};

export const readDataForSeoSerp = (projectId: string): DataForSEOSerpItem[] => {
  try {
    const value: unknown = JSON.parse(readStorage(dataForSeoSerpKey(projectId)) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is DataForSEOSerpItem => Boolean(
      item && typeof item === 'object' &&
      typeof item.type === 'string' &&
      isFiniteNumber(item.rank_group) && isFiniteNumber(item.rank_absolute) &&
      typeof item.domain === 'string' && typeof item.title === 'string' &&
      typeof item.description === 'string' && typeof item.url === 'string',
    )).slice(0, 100);
  } catch {
    return [];
  }
};

export const readDataForSeoTarget = (projectId: string): string | null => {
  const target = readStorage(dataForSeoTargetKey(projectId))?.trim().toLowerCase();
  return target || null;
};
