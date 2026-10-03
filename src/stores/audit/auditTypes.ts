import { DataForSEOBacklinkSummary, DataForSEOSerpItem, PageAuditData, TabType } from '@/types';

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

export type AuditHistoryPersistResult = { saved: boolean; compacted: boolean; quota: boolean };

export interface AuditState {
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
