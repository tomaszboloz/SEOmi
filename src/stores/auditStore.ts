import { create } from 'zustand';
import { AuditState } from './audit/auditTypes';
import { createAuditMainSlice } from './audit/auditMainSlice';
import { createAuditSeoSlice } from './audit/auditSeoSlice';
import { createAuditBatchSlice } from './audit/auditBatchSlice';

export const useAuditStore = create<AuditState>((set, get, api) => ({
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

  ...createAuditMainSlice(set, get, api),
  ...createAuditSeoSlice(set, get, api),
  ...createAuditBatchSlice(set, get, api),
}));

export * from './audit/auditTypes';
