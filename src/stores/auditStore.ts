import { create } from 'zustand';
import { DataForSEOBacklinkSummary, DataForSEOSerpItem, PageAuditData, TabType } from '@/types';
import { DataForSEOClient } from '@/services/dataforseo';
import { invokeTauriCommand } from '@/services/tauri';
import { useSettingsStore } from './settingsStore';
import { importUrlsFromCsv } from '@/services/csvUrls';
import { notifyAuditCompleted, notifyBatchCompleted } from '@/services/desktopNotifications';
import { createId } from '@/services/ids';
import { readStorage, removeStorage, writeStorage, writeStorageResult } from '@/services/storage';
import { useProjectStore } from './projectStore';
import i18n from '@/i18n';
import { ALL_WORKSPACE_TABS } from '@/services/workspaceRoutes';
import { isStorageQuotaError } from '@/services/crawlPersistence';
import {
  acknowledgeNativeAuditQueueExecution,
  acknowledgeNativeAuditQueueResult,
  deleteNativeAuditQueue,
  loadNativeAuditQueue,
  loadNativeAuditQueueExecutions,
  loadNativeAuditQueueResults,
  saveNativeAuditQueue,
} from '@/services/auditQueuePersistence';
import { syncAuditQueueWakeup } from '@/services/scheduleWakeup';

const LEGACY_HISTORY_KEY = 'seomi_audit_history';
const ACTIVE_PROJECT_KEY = 'seomi_active_project_v1';
const historyKey = (projectId: string) => `seomi_project_${projectId}_audit_history`;
const batchQueueKey = (projectId: string) => `seomi_project_${projectId}_audit_queue_v1`;
const batchRunKey = (projectId: string) => `seomi_project_${projectId}_audit_queue_run_v1`;
const onlyProblemsKey = (projectId: string) => `seomi_project_${projectId}_audit_only_problems_v1`;
const activeTabKey = (projectId: string) => `seomi_project_${projectId}_active_tab_v1`;
const dataForSeoSummaryKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_summary_v1`;
const dataForSeoSerpKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_serp_v1`;
const activeProjectId = (): string | null => readStorage(ACTIVE_PROJECT_KEY) || useProjectStore.getState().activeProjectId;
let activeBatchProjectId: string | null = null;

const projectTabs: readonly TabType[] = ALL_WORKSPACE_TABS;

const readActiveTab = (projectId: string): TabType => {
  try {
    const value = readStorage(activeTabKey(projectId));
    return projectTabs.includes(value as TabType) ? value as TabType : 'overview';
  } catch {
    return 'overview';
  }
};

export type BatchAuditStatus = 'queued' | 'running' | 'interrupted' | 'completed' | 'failed';

export interface BatchAuditItem {
  id: string;
  url: string;
  status: BatchAuditStatus;
  error?: string;
  attempts?: number;
  updatedAt?: string;
  completedAt?: string;
}

export type BatchAuditRunStatus = 'running' | 'interrupted' | 'stopped' | 'completed';

export interface BatchAuditRun {
  id: string;
  status: BatchAuditRunStatus;
  startedAt: string;
  updatedAt: string;
  activeItemId?: string;
  lastError?: string;
  stopRequested?: boolean;
  userAgent?: string;
}

const readHistory = (projectId: string): PageAuditData[] => {
  try {
    const value = JSON.parse(readStorage(historyKey(projectId)) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const parseBatchQueue = (value: unknown): BatchAuditItem[] => Array.isArray(value)
  ? value.filter((item): item is BatchAuditItem => Boolean(
    item && typeof item === 'object'
      && typeof (item as Partial<BatchAuditItem>).id === 'string'
      && typeof (item as Partial<BatchAuditItem>).url === 'string'
      && ['queued', 'running', 'interrupted', 'completed', 'failed'].includes((item as Partial<BatchAuditItem>).status || ''),
  ))
  : [];

const parseBatchRun = (value: unknown): BatchAuditRun | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BatchAuditRun>;
  if (typeof candidate.id !== 'string' || typeof candidate.startedAt !== 'string' || typeof candidate.updatedAt !== 'string') return null;
  if (!['running', 'interrupted', 'stopped', 'completed'].includes(candidate.status || '')) return null;
  return candidate as BatchAuditRun;
};

const readBatchQueue = (projectId: string): BatchAuditItem[] => {
  try { return parseBatchQueue(JSON.parse(readStorage(batchQueueKey(projectId)) || '[]')); } catch { return []; }
};

const readBatchRun = (projectId: string): BatchAuditRun | null => {
  try { return parseBatchRun(JSON.parse(readStorage(batchRunKey(projectId)) || 'null')); } catch { return null; }
};

const recoverInterruptedBatch = (items: BatchAuditItem[], run: BatchAuditRun | null): { items: BatchAuditItem[]; run: BatchAuditRun | null; changed: boolean } => {
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

const nativeQueueWrites = new Map<string, Promise<boolean>>();

const persistNativeBatchSnapshot = (projectId: string, items: BatchAuditItem[], run: BatchAuditRun | null): void => {
  const snapshot = { items: items.slice(0, 50_000), run };
  const previous = nativeQueueWrites.get(projectId) || Promise.resolve(true);
  const next = previous.then(() => saveNativeAuditQueue(projectId, snapshot));
  nativeQueueWrites.set(projectId, next);
  void next.then(() => {
    if (nativeQueueWrites.get(projectId) === next) nativeQueueWrites.delete(projectId);
  });
};

const reconcileNativeBatchResults = async (
  projectId: string,
  readState: () => Pick<AuditState, 'batchItems' | 'batchRun' | 'isBatchRunning'>,
  setState: (patch: Partial<AuditState>) => void,
): Promise<void> => {
  const nativeResults = await loadNativeAuditQueueResults(projectId);
  if (activeProjectId() !== projectId || readState().isBatchRunning) return;
  const recoveredAudits = nativeResults
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as { runId?: unknown; itemId?: unknown; audit?: unknown };
      if (typeof candidate.runId !== 'string' || typeof candidate.itemId !== 'string' || !candidate.audit || typeof candidate.audit !== 'object') return null;
      const audit = candidate.audit as Partial<PageAuditData>;
      if (typeof audit.url !== 'string' || typeof audit.timestamp !== 'string') return null;
      return { runId: candidate.runId, itemId: candidate.itemId, audit: candidate.audit as PageAuditData };
    })
    .filter((entry): entry is { runId: string; itemId: string; audit: PageAuditData } => Boolean(entry));
  if (recoveredAudits.length) {
    const currentHistory = readHistory(projectId);
    const mergedHistory = recoveredAudits.reduce<PageAuditData[]>((history, entry) => [
      entry.audit,
      ...history.filter((item) => item.timestamp !== entry.audit.timestamp && item.final_url !== entry.audit.final_url),
    ], currentHistory).slice(0, 25);
    if (persistAuditHistory(projectId, mergedHistory).saved) {
      setState({ history: mergedHistory, currentAudit: mergedHistory[0] || null });
      for (const entry of recoveredAudits) {
        await acknowledgeNativeAuditQueueResult(projectId, entry.runId, entry.itemId).catch(() => undefined);
      }
    }
  }
  const nativeExecutions = await loadNativeAuditQueueExecutions(projectId);
  for (const execution of nativeExecutions) {
    if (!execution || typeof execution !== 'object') continue;
    const runId = (execution as { runId?: unknown }).runId;
    if (typeof runId === 'string') {
      await acknowledgeNativeAuditQueueExecution(projectId, runId).catch(() => undefined);
    }
  }
};

const clearNativeBatchSnapshot = (projectId: string): void => {
  const previous = nativeQueueWrites.get(projectId) || Promise.resolve(true);
  const next = previous.then(() => deleteNativeAuditQueue(projectId));
  nativeQueueWrites.set(projectId, next);
  void next.then(() => {
    if (nativeQueueWrites.get(projectId) === next) nativeQueueWrites.delete(projectId);
  });
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const readDataForSeoSummary = (projectId: string): DataForSEOBacklinkSummary | null => {
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

const readDataForSeoSerp = (projectId: string): DataForSEOSerpItem[] => {
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

const auditHostname = (audit: PageAuditData | null): string | null => {
  if (!audit) return null;
  try {
    const hostname = new URL(audit.final_url || audit.url).hostname.toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
};

const dataForSeoTargetKey = (projectId: string) => `${dataForSeoSummaryKey(projectId)}_target`;
const auditRequestTokens = new Map<string, string>();
const beginAuditRequest = (kind: string): string => {
  const token = createId(`audit-${kind}`);
  auditRequestTokens.set(kind, token);
  return token;
};
const isLatestAuditRequest = (kind: string, token: string): boolean => auditRequestTokens.get(kind) === token;

const formatAuditRuntimeError = (error: unknown): string => {
  if (isStorageQuotaError(error)) return i18n.t('runtimeErrors.persistence.localQuota');
  return error instanceof Error ? error.message : i18n.t('runtimeErrors.audit.historySave');
};

type AuditHistoryPersistResult = { saved: boolean; compacted: boolean; quota: boolean };

/**
 * Page audits contain verbose link/image/schema evidence. Keep the live result
 * complete, but progressively bound only the durable history when a WebView
 * quota rejects the normal snapshot. This mirrors crawl-history recovery and
 * prevents a successful audit from being reported as a failed request.
 */
const compactAuditForHistory = (audit: PageAuditData, level: 1 | 2): PageAuditData => {
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

const persistAuditHistory = (projectId: string, history: PageAuditData[]): AuditHistoryPersistResult => {
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

const formatQueueWakeupError = (error: unknown): string => i18n.t('schedules.schedulerError', {
  error: error instanceof Error ? error.message : String(error),
});

const readDataForSeoTarget = (projectId: string): string | null => {
  const target = readStorage(dataForSeoTargetKey(projectId))?.trim().toLowerCase();
  return target || null;
};

const writeBatchRun = (projectId: string, run: BatchAuditRun | null): void => {
  try {
    if (run) writeStorage(batchRunKey(projectId), JSON.stringify(run));
    else removeStorage(batchRunKey(projectId));
  } catch {
    // The queue remains usable in memory when a locked-down WebView rejects storage.
  }
};

interface AuditState {
  currentAudit: PageAuditData | null;
  history: PageAuditData[];
  isLoading: boolean;
  error: string | null;
  activeTab: TabType;
  searchFilter: string;
  showOnlyProblems: boolean;
  selectedUserAgent: string;
  dataforseoData: DataForSEOBacklinkSummary | null;
  dataforseoSerp: DataForSEOSerpItem[];
  isDataForSEOLoading: boolean;
  dataforseoError: string | null;
  batchItems: BatchAuditItem[];
  batchRun: BatchAuditRun | null;
  batchRejectedRows: string[];
  isBatchRunning: boolean;
  isBatchStopping: boolean;
  batchWakeupError: string | null;
  activeBatchRequestId: string | null;
  startAudit: (url: string, userAgent?: string) => Promise<boolean>;
  setAuditData: (data: PageAuditData) => void;
  importScheduledAuditResult: (data: unknown) => boolean;
  setActiveTab: (tab: TabType) => void;
  setSearchFilter: (query: string) => void;
  setShowOnlyProblems: (value: boolean) => void;
  setSelectedUserAgent: (ua: string) => void;
  clearAudit: () => void;
  removeFromHistory: (index: number) => void;
  fetchDataForSEO: (domain?: string) => Promise<void>;
  fetchDataForSEOSerp: (keyword: string, locationCode?: number, languageCode?: string) => Promise<void>;
  setDataForSEOData: (data: DataForSEOBacklinkSummary | null) => void;
  importAuditCsv: (csv: string) => void;
  startBatchAudits: () => Promise<void>;
  stopBatchAudits: () => void;
  clearBatchAudits: () => void;
  hydrateProject: (projectId: string | null) => void;
}

const batchSnapshotFingerprint = (items: BatchAuditItem[], run: BatchAuditRun | null): string => [
  ...items.map((item) => `${item.id}:${item.status}:${item.updatedAt || ''}:${item.attempts || 0}`),
  run ? `${run.id}:${run.status}:${run.updatedAt}:${run.activeItemId || ''}` : '',
].join('|');

const hydrateNativeBatchQueue = async (
  projectId: string,
  readState: () => Pick<AuditState, 'batchItems' | 'batchRun' | 'isBatchRunning'>,
  setState: (patch: Partial<AuditState>) => void,
): Promise<void> => {
  const initial = readState();
  const initialFingerprint = batchSnapshotFingerprint(initial.batchItems, initial.batchRun);
  const loaded = await loadNativeAuditQueue(projectId);
  if (!loaded.available || activeProjectId() !== projectId) return;

  const current = readState();
  if (current.isBatchRunning || activeBatchProjectId === projectId) return;
  // A user may have imported or cleared a queue while the native read was in
  // flight. Their current in-memory state wins; persist it instead of
  // overwriting it with an older desktop snapshot.
  if (batchSnapshotFingerprint(current.batchItems, current.batchRun) !== initialFingerprint) {
    persistNativeBatchSnapshot(projectId, current.batchItems, current.batchRun);
    return;
  }

  if (loaded.snapshot === null) {
    persistNativeBatchSnapshot(projectId, current.batchItems, current.batchRun);
    await reconcileNativeBatchResults(projectId, readState, setState);
    return;
  }
  if (!loaded.snapshot || typeof loaded.snapshot !== 'object') return;
  const candidate = loaded.snapshot as { items?: unknown; run?: unknown };
  if (!Array.isArray(candidate.items)) return;
  const nativeRun = candidate.run === null || candidate.run === undefined ? null : parseBatchRun(candidate.run);
  if (candidate.run !== null && candidate.run !== undefined && !nativeRun) return;
  const recovered = recoverInterruptedBatch(parseBatchQueue(candidate.items), nativeRun);
  if (activeProjectId() !== projectId || readState().isBatchRunning) return;
  setState({ batchItems: recovered.items, batchRun: recovered.run });
  writeStorage(batchQueueKey(projectId), JSON.stringify(recovered.items));
  writeBatchRun(projectId, recovered.run);
  persistNativeBatchSnapshot(projectId, recovered.items, recovered.run);
  await reconcileNativeBatchResults(projectId, readState, setState);
};

export const useAuditStore = create<AuditState>((set, get) => ({
  currentAudit: null,
  history: [],
  isLoading: false,
  error: null,
  activeTab: 'overview',
  searchFilter: '',
  showOnlyProblems: false,
  selectedUserAgent: 'chrome_mac',
  dataforseoData: null,
  dataforseoSerp: [],
  isDataForSEOLoading: false,
  dataforseoError: null,
  batchItems: [],
  batchRun: null,
  batchRejectedRows: [],
  isBatchRunning: false,
  isBatchStopping: false,
  batchWakeupError: null,
  activeBatchRequestId: null,

  startAudit: async (url, userAgent) => {
    const projectId = activeProjectId();
    if (!projectId) {
      set({ error: i18n.t('runtimeErrors.audit.projectRequired') });
      return false;
    }
    const requestToken = beginAuditRequest('single');
    const projectHistory = readHistory(projectId);
    // Live provider results belong to the audit target. Clear the visible
    // result before a new request so a previous domain can never be mistaken
    // for evidence for the URL currently being inspected.
    set({ isLoading: true, error: null, dataforseoData: null, dataforseoSerp: [], dataforseoError: null, isDataForSEOLoading: false });
    try {
      const data = await invokeTauriCommand<PageAuditData>('inspect_url', { url, userAgent: userAgent || get().selectedUserAgent || useSettingsStore.getState().config.default_user_agent, timeoutSecs: useSettingsStore.getState().config.request_timeout_secs, maxRedirects: useSettingsStore.getState().config.max_redirects, verifySsl: useSettingsStore.getState().config.verify_ssl });
      if (!isLatestAuditRequest('single', requestToken) && activeProjectId() === projectId) return false;
      const previousAudit = projectHistory.find((item) => item.final_url === data.final_url || item.url === url);
      const history = [data, ...projectHistory.filter((item) => item.final_url !== data.final_url)].slice(0, 25);
      const historyPersisted = persistAuditHistory(projectId, history);
      const historySaved = historyPersisted.saved;
      const projectIsStillActive = activeProjectId() === projectId && isLatestAuditRequest('single', requestToken);
      if (projectIsStillActive) set({ currentAudit: data, history, isLoading: false, error: historySaved ? null : i18n.t('runtimeErrors.audit.historySave') });
      void notifyAuditCompleted(projectId, data, previousAudit?.health_score);
      return true;
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('single', requestToken)) {
        set({ error: formatAuditRuntimeError(error), isLoading: false });
      }
      return false;
    }
  },
  setAuditData: (data) => {
    beginAuditRequest('single');
    set({ currentAudit: data, error: null, isLoading: false });
  },
  importScheduledAuditResult: (data) => {
    if (!data || typeof data !== 'object') return false;
    const candidate = data as Partial<PageAuditData>;
    if (typeof candidate.url !== 'string' || typeof candidate.timestamp !== 'string') return false;
    const projectId = activeProjectId();
    if (!projectId) return false;
    beginAuditRequest('single');
    const current = readHistory(projectId);
    const audit = data as PageAuditData;
    const history = [audit, ...current.filter((item) => item.timestamp !== audit.timestamp && item.final_url !== audit.final_url)].slice(0, 25);
    if (!persistAuditHistory(projectId, history).saved) return false;
    if (activeProjectId() === projectId) set({ currentAudit: audit, history, isLoading: false, error: null });
    return true;
  },
  setActiveTab: (activeTab) => {
    try {
      const projectId = activeProjectId();
      if (projectId) {
        writeStorage(activeTabKey(projectId), activeTab);
      }
    } catch {
      // Keep navigation usable if the desktop WebView rejects storage.
    }
    set({ activeTab });
  },
  setSearchFilter: (searchFilter) => set({ searchFilter }),
  setShowOnlyProblems: (showOnlyProblems) => {
    const projectId = activeProjectId();
    if (projectId) writeStorage(onlyProblemsKey(projectId), String(showOnlyProblems));
    set({ showOnlyProblems });
  },
  setSelectedUserAgent: (selectedUserAgent) => set({ selectedUserAgent }),
  clearAudit: () => {
    beginAuditRequest('single');
    set({ currentAudit: null, error: null, isLoading: false });
  },
  removeFromHistory: (index) => {
    const history = get().history.filter((_, itemIndex) => itemIndex !== index);
    const projectId = activeProjectId();
    if (projectId) persistAuditHistory(projectId, history);
    set({ history, currentAudit: history.find((item) => item.timestamp === get().currentAudit?.timestamp) || null });
  },

  fetchDataForSEO: async (domain) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ dataforseoData: null, dataforseoError: i18n.t('runtimeErrors.tools.projectRequired'), isDataForSEOLoading: false });
    const activeAudit = get().currentAudit;
    let target = domain?.trim() || '';
    if (!target && activeAudit) {
      try { target = new URL(activeAudit.final_url || activeAudit.url).hostname; } catch { target = ''; }
    }
    const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
    if (!login || !password || !target) return set({ dataforseoData: null, dataforseoError: !target ? i18n.t('runtimeErrors.audit.dataforseoDomain') : i18n.t('runtimeErrors.audit.dataforseoConnection'), isDataForSEOLoading: false });
    const requestToken = beginAuditRequest('dataforseo-summary');
    set({ isDataForSEOLoading: true, dataforseoError: null });
    try {
      const dataforseoData = await new DataForSEOClient(login, password).getBacklinksSummary(target);
      // A request can finish after the user has switched projects. Keep the
      // source project's persisted evidence, but never mutate the new one.
      if (!isLatestAuditRequest('dataforseo-summary', requestToken) && activeProjectId() === projectId) return;
      if (dataforseoData) {
        writeStorage(dataForSeoSummaryKey(projectId), JSON.stringify(dataforseoData));
        writeStorage(dataForSeoTargetKey(projectId), dataforseoData.target.toLowerCase());
        if (activeProjectId() !== projectId) return;
        set({ dataforseoData, isDataForSEOLoading: false });
      } else {
        if (activeProjectId() !== projectId) return;
        set({ dataforseoData: null, dataforseoError: i18n.t('runtimeErrors.tools.backlinkNoProfile'), isDataForSEOLoading: false });
      }
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('dataforseo-summary', requestToken)) set({ dataforseoData: null, dataforseoError: error instanceof Error ? error.message : String(error), isDataForSEOLoading: false });
    }
  },
  fetchDataForSEOSerp: async (keyword, locationCode = 2840, languageCode = 'en') => {
    const projectId = activeProjectId();
    if (!projectId) return set({ dataforseoSerp: [], dataforseoError: i18n.t('runtimeErrors.tools.projectRequired'), isDataForSEOLoading: false });
    const { login, password } = useSettingsStore.getState().dataForSeoCredentials;
    if (!login || !password) return set({ dataforseoSerp: [], dataforseoError: i18n.t('runtimeErrors.audit.dataforseoConnection'), isDataForSEOLoading: false });
    const requestToken = beginAuditRequest('dataforseo-serp');
    set({ isDataForSEOLoading: true, dataforseoError: null });
    try {
      const dataforseoSerp = await new DataForSEOClient(login, password).getSerpCompetitors(keyword, locationCode, languageCode);
      if (!isLatestAuditRequest('dataforseo-serp', requestToken) && activeProjectId() === projectId) return;
      writeStorage(dataForSeoSerpKey(projectId), JSON.stringify(dataforseoSerp));
      if (activeProjectId() !== projectId) return;
      set({ dataforseoSerp, isDataForSEOLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestAuditRequest('dataforseo-serp', requestToken)) set({ dataforseoSerp: [], dataforseoError: error instanceof Error ? error.message : String(error), isDataForSEOLoading: false });
    }
  },
  setDataForSEOData: (dataforseoData) => {
    beginAuditRequest('dataforseo-summary');
    const projectId = activeProjectId();
    if (projectId && dataforseoData) {
      writeStorage(dataForSeoSummaryKey(projectId), JSON.stringify(dataforseoData));
      writeStorage(dataForSeoTargetKey(projectId), dataforseoData.target.toLowerCase());
    }
    set({ dataforseoData });
  },
  importAuditCsv: (csv) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ error: i18n.t('runtimeErrors.tools.projectRequired') });
    const imported = importUrlsFromCsv(csv);
    const existing = get().batchItems;
    const existingUrls = new Set(existing.map((item) => item.url));
    const newItems = imported.urls
      .filter((url) => !existingUrls.has(url))
      .map((url) => ({ id: createId('batch-item'), url, status: 'queued' as const, updatedAt: new Date().toISOString() }));
    const batchItems = [...existing, ...newItems];
    const queueSaved = writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems));
    set({
      batchItems,
      batchRejectedRows: imported.rejected,
      error: !imported.urls.length
        ? i18n.t('runtimeErrors.audit.csvInvalid')
        : queueSaved ? null : i18n.t('runtimeErrors.audit.queueSave'),
    });
    persistNativeBatchSnapshot(projectId, batchItems, get().batchRun);
  },
  startBatchAudits: async () => {
    const projectId = activeProjectId();
    if (!projectId) return set({ error: i18n.t('runtimeErrors.tools.projectRequired') });
    if (get().isBatchRunning) return;
    let queueItems = get().batchItems.map((item) => ({ ...item }));
    const isSourceProjectActive = () => activeProjectId() === projectId;
    const persistQueue = (batchItems: BatchAuditItem[]) => {
      queueItems = batchItems;
      if (isSourceProjectActive()) set({ batchItems });
      try {
        if (!writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems))) {
          if (isSourceProjectActive()) set({ error: i18n.t('runtimeErrors.audit.queueSave') });
        }
      } catch (error) {
        if (isSourceProjectActive()) set({ error: isStorageQuotaError(error) ? i18n.t('runtimeErrors.persistence.localQuota') : i18n.t('runtimeErrors.audit.queueSave') });
      }
      persistNativeBatchSnapshot(projectId, batchItems, runState);
    };
    const now = new Date().toISOString();
    const selectedUserAgentAtStart = get().selectedUserAgent;
    const persistedRun = readBatchRun(projectId);
    const previousRun = persistedRun || (activeBatchProjectId === projectId ? get().batchRun : null);
    const run: BatchAuditRun = {
      id: previousRun?.id || createId('audit-run'),
      status: 'running',
      startedAt: previousRun?.startedAt || now,
      updatedAt: now,
      stopRequested: false,
      userAgent: previousRun?.userAgent || selectedUserAgentAtStart,
    };
    activeBatchProjectId = projectId;
    set({ isBatchRunning: true, isBatchStopping: false, error: null, batchRun: run });
    writeBatchRun(projectId, run);
    persistNativeBatchSnapshot(projectId, queueItems, run);
    const isCurrentSourceRun = () => isSourceProjectActive()
      && activeBatchProjectId === projectId
      && get().batchRun?.id === run.id;
    const sourceStopRequested = () => {
      const persisted = readBatchRun(projectId)?.stopRequested === true;
      if (!isSourceProjectActive() || !isCurrentSourceRun()) return persisted;
      return persisted || get().isBatchStopping || Boolean(get().batchRun?.stopRequested);
    };
    // Keep a delayed one-shot OS wake-up armed while the foreground queue is
    // active. The native worker will execute only when this run becomes stale,
    // which covers a closed/crashed WebView without duplicating an open run.
    void syncAuditQueueWakeup(projectId, run.id, true)
      .then(() => {
        if (activeProjectId() === projectId && activeBatchProjectId === projectId && get().batchRun?.id === run.id) {
          set({ batchWakeupError: null });
        }
      })
      .catch((error) => {
        if (activeProjectId() === projectId && activeBatchProjectId === projectId && get().batchRun?.id === run.id) {
          set({ batchWakeupError: formatQueueWakeupError(error) });
        }
      });
    let completedCount = 0;
    let failedCount = 0;
    let regressionCount = 0;
    let runState = run;
    const persistRun = (patch: Partial<BatchAuditRun>) => {
      runState = { ...runState, ...patch, updatedAt: new Date().toISOString() };
      if (isCurrentSourceRun()) set({ batchRun: runState });
      writeBatchRun(projectId, runState);
      persistNativeBatchSnapshot(projectId, queueItems, runState);
    };
    for (const item of queueItems) {
      if (sourceStopRequested()) break;
      if (item.status !== 'queued' && item.status !== 'failed' && item.status !== 'interrupted') continue;
      const startedItemAt = new Date().toISOString();
      persistRun({ activeItemId: item.id, lastError: undefined, stopRequested: false });
      persistQueue(queueItems.map((candidate) => candidate.id === item.id ? {
        ...candidate,
        status: 'running',
        attempts: (candidate.attempts || 0) + 1,
        updatedAt: startedItemAt,
        error: undefined,
      } : candidate));
      try {
        const requestId = createId('audit');
        if (isCurrentSourceRun()) set({ activeBatchRequestId: requestId });
        if (sourceStopRequested()) {
          void invokeTauriCommand('cancel_inspect_url', { requestId }).catch(() => undefined);
        }
        const data = await invokeTauriCommand<PageAuditData>('inspect_url', { url: item.url, userAgent: run.userAgent || selectedUserAgentAtStart || useSettingsStore.getState().config.default_user_agent, requestId, timeoutSecs: useSettingsStore.getState().config.request_timeout_secs, maxRedirects: useSettingsStore.getState().config.max_redirects, verifySsl: useSettingsStore.getState().config.verify_ssl });
        const sourceHistory = readHistory(projectId);
        const previousAudit = sourceHistory.find((candidate) => candidate.final_url === data.final_url || candidate.url === item.url);
        const history = [data, ...sourceHistory.filter((candidate) => candidate.final_url !== data.final_url)].slice(0, 25);
        try {
          if (!persistAuditHistory(projectId, history).saved) {
            if (isSourceProjectActive()) set({ error: i18n.t('runtimeErrors.audit.historySave') });
          }
        } catch (storageError) {
          if (isSourceProjectActive()) set({ error: storageError instanceof Error ? storageError.message : i18n.t('runtimeErrors.audit.historySave') });
        }
        if (isCurrentSourceRun()) set({ currentAudit: data, history });
        completedCount += 1;
        if (typeof previousAudit?.health_score === 'number' && data.health_score < previousAudit.health_score) {
          regressionCount += 1;
        }
        persistQueue(queueItems.map((candidate) => candidate.id === item.id ? { ...candidate, status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), error: undefined } : candidate));
        persistRun({ activeItemId: undefined });
      } catch (error) {
        const wasStopped = sourceStopRequested();
        if (!wasStopped) failedCount += 1;
        persistQueue(queueItems.map((candidate) => candidate.id === item.id ? {
          ...candidate,
          status: wasStopped ? 'queued' : 'failed',
          updatedAt: new Date().toISOString(),
          error: wasStopped ? i18n.t('runtimeErrors.audit.batchStopped') : formatAuditRuntimeError(error),
        } : candidate));
        persistRun({ activeItemId: undefined, lastError: wasStopped ? undefined : formatAuditRuntimeError(error) });
      }
    }
    const remaining = queueItems.some((item) => item.status === 'queued' || item.status === 'running' || item.status === 'interrupted' || item.status === 'failed');
    const stopped = sourceStopRequested();
    persistRun({
      status: stopped || remaining ? 'stopped' : 'completed',
      activeItemId: undefined,
      stopRequested: false,
    });
    const queuedCount = queueItems.filter((item) => item.status === 'queued' || item.status === 'interrupted' || item.status === 'running').length;
    void notifyBatchCompleted(projectId, {
      completed: completedCount,
      failed: failedCount,
      queued: queuedCount,
      regressionCount,
      stopped: stopped || queuedCount > 0,
    });
    void syncAuditQueueWakeup(projectId, runState.id, false)
      .catch((error) => {
        if (activeProjectId() === projectId && get().batchRun?.id === runState.id) {
          set({ batchWakeupError: formatQueueWakeupError(error) });
        }
      });
    const shouldFinalizeSourceUi = isCurrentSourceRun();
    if (shouldFinalizeSourceUi) set({ isBatchRunning: false, isBatchStopping: false, activeBatchRequestId: null });
    if (activeBatchProjectId === projectId) activeBatchProjectId = null;
  },
  stopBatchAudits: () => {
    const requestId = get().activeBatchRequestId;
    set({ isBatchStopping: true });
    const projectId = activeProjectId();
    const currentRun = get().batchRun;
    if (projectId && currentRun) {
      const run: BatchAuditRun = { ...currentRun, stopRequested: true, updatedAt: new Date().toISOString() };
      set({ batchRun: run });
      writeBatchRun(projectId, run);
      persistNativeBatchSnapshot(projectId, get().batchItems, run);
      void syncAuditQueueWakeup(projectId, currentRun.id, false)
        .catch((error) => { if (activeProjectId() === projectId) set({ batchWakeupError: formatQueueWakeupError(error) }); });
    }
    if (requestId) {
      void invokeTauriCommand('cancel_inspect_url', { requestId }).catch(() => undefined);
    }
  },
  clearBatchAudits: () => {
    const projectId = activeProjectId();
    if (get().isBatchRunning) return;
    if (projectId) removeStorage(batchQueueKey(projectId));
    if (projectId) writeBatchRun(projectId, null);
    if (projectId) clearNativeBatchSnapshot(projectId);
    if (projectId && get().batchRun?.id) void syncAuditQueueWakeup(projectId, get().batchRun?.id || null, false)
      .catch((error) => { if (activeProjectId() === projectId) set({ batchWakeupError: formatQueueWakeupError(error) }); });
    set({ batchItems: [], batchRun: null, batchRejectedRows: [], isBatchStopping: false, activeBatchRequestId: null, batchWakeupError: null });
  },
  hydrateProject: (projectId) => {
    beginAuditRequest('single');
    beginAuditRequest('dataforseo-summary');
    beginAuditRequest('dataforseo-serp');
    if (!projectId) return set({ currentAudit: null, history: [], isLoading: false, activeTab: 'overview', dataforseoData: null, dataforseoSerp: [], dataforseoError: null, batchItems: [], batchRun: null, batchRejectedRows: [], isBatchRunning: false, isBatchStopping: false, batchWakeupError: null, activeBatchRequestId: null, showOnlyProblems: false });
    let history = readHistory(projectId);
    const legacy = readStorage(LEGACY_HISTORY_KEY);
    if (!history.length && legacy && !readStorage('seomi_legacy_history_migrated_v1')) {
      writeStorage(historyKey(projectId), legacy);
      removeStorage(LEGACY_HISTORY_KEY);
      writeStorage('seomi_legacy_history_migrated_v1', 'true');
      history = readHistory(projectId);
    }
    let batchItems = readBatchQueue(projectId);
    let batchRun = readBatchRun(projectId);
    const hasRunningItem = batchItems.some((item) => item.status === 'running');
    if ((batchRun?.status === 'running' || hasRunningItem) && activeBatchProjectId !== projectId) {
      const interruptedAt = new Date().toISOString();
      batchItems = batchItems.map((item) => item.status === 'running' ? {
        ...item,
        status: 'interrupted' as const,
        updatedAt: interruptedAt,
        error: i18n.t('runtimeErrors.audit.batchInterrupted'),
      } : item);
      batchRun = batchRun ? { ...batchRun, status: 'interrupted', updatedAt: interruptedAt, stopRequested: false } : {
        id: createId('batch-run'),
        status: 'interrupted',
        startedAt: interruptedAt,
        updatedAt: interruptedAt,
      };
      try {
        writeStorage(batchQueueKey(projectId), JSON.stringify(batchItems));
      } catch {
        // Hydration still exposes the recovered queue in memory.
      }
      writeBatchRun(projectId, batchRun);
      persistNativeBatchSnapshot(projectId, batchItems, batchRun);
    }
    const hydratedAudit = history[0] || null;
    const storedTarget = readDataForSeoTarget(projectId);
    const hydratedTarget = auditHostname(hydratedAudit);
    const canRestoreLiveEvidence = Boolean(storedTarget && hydratedTarget && (storedTarget === hydratedTarget || storedTarget.replace(/^www\./, '') === hydratedTarget.replace(/^www\./, '')));
    set({ currentAudit: hydratedAudit, history, isLoading: false, activeTab: readActiveTab(projectId), dataforseoData: canRestoreLiveEvidence ? readDataForSeoSummary(projectId) : null, dataforseoSerp: canRestoreLiveEvidence ? readDataForSeoSerp(projectId) : [], dataforseoError: null, batchItems, batchRun, batchRejectedRows: [], isBatchRunning: activeBatchProjectId === projectId, isBatchStopping: false, batchWakeupError: null, activeBatchRequestId: null, showOnlyProblems: readStorage(onlyProblemsKey(projectId)) === 'true' });
    void hydrateNativeBatchQueue(projectId, get, set);
  },
}));
