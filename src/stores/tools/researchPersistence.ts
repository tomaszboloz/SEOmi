
import { DomainOverviewData, DomainComparisonData, DomainComparisonHistory, BacklinkProfileData, BacklinkProfileHistory, BacklinkProfileSnapshot, BacklinkGapReport } from '@/types';

import { readJsonStorage, writeJsonStorage } from '@/services/storage';

import { parseBacklinkGapReport, parseBacklinkProfile, parseBacklinkSnapshot, parseDomainComparison, parseDomainOverview, parseResearchHistory } from '@/services/researchContracts';

import { domainComparisonKey, domainComparisonHistoryKey, domainComparisonTargetsKey, domainOverviewKey, backlinkProfileKey, backlinkProfileHistoryKey, backlinkGapReportKey, activeProjectId } from './storageKeys';

export const saveProjectResearch = (key: (projectId: string) => string, value: unknown, projectId = activeProjectId()) => {
  if (!projectId) return;
  writeJsonStorage(key(projectId), value);
};

export const readProjectResearch = (key: (projectId: string) => string, projectId: string): unknown => {
  return readJsonStorage<unknown>(key(projectId), null);
};

export const loadDomainComparisonTargets = (projectId: string): string[] => {
  const value = readProjectResearch(domainComparisonTargetsKey, projectId);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
};

export const loadDomainComparison = (projectId: string): DomainComparisonData | null => {
  return parseDomainComparison(readProjectResearch(domainComparisonKey, projectId));
};

export const normalizeDomainComparisonHistory = (value: unknown): DomainComparisonHistory => {
  return parseResearchHistory(value, parseDomainComparison, 12, 'last');
};

export const loadDomainComparisonHistory = (projectId: string): DomainComparisonHistory => {
  const stored = readProjectResearch(domainComparisonHistoryKey, projectId);
  const history = normalizeDomainComparisonHistory(stored);
  if (history.length) return history;
  const current = loadDomainComparison(projectId);
  return current ? [current] : [];
};

export const loadLatestDomainComparison = (projectId: string): DomainComparisonData | null => {
  const current = loadDomainComparison(projectId);
  if (current) return current;
  const history = loadDomainComparisonHistory(projectId);
  return history[history.length - 1] || null;
};

export const loadDomainOverview = (projectId: string): DomainOverviewData | null => {
  return parseDomainOverview(readProjectResearch(domainOverviewKey, projectId));
};

export const loadBacklinkProfile = (projectId: string): BacklinkProfileData | null => {
  return parseBacklinkProfile(readProjectResearch(backlinkProfileKey, projectId));
};

export const normalizeBacklinkProfileHistory = (value: unknown): BacklinkProfileHistory => {
  return parseResearchHistory(value, parseBacklinkSnapshot, 12, 'last');
};

export const loadBacklinkProfileHistory = (projectId: string): BacklinkProfileHistory => normalizeBacklinkProfileHistory(
  readProjectResearch(backlinkProfileHistoryKey, projectId),
);

export const saveBacklinkProfileSnapshot = (
  projectId: string,
  profile: BacklinkProfileData,
  history: BacklinkProfileHistory,
): BacklinkProfileHistory => {
  const snapshot: BacklinkProfileSnapshot = {
    domain: profile.domain,
    retrieved_at: new Date().toISOString(),
    total_backlinks: Number.isFinite(profile.total_backlinks) ? profile.total_backlinks : null,
    referring_domains: Number.isFinite(profile.referring_domains) ? profile.referring_domains : null,
    domain_rank: Number.isFinite(profile.domain_rank) ? profile.domain_rank : null,
    dofollow_ratio: Number.isFinite(profile.dofollow_ratio) ? profile.dofollow_ratio : null,
  };
  const next = [...history, snapshot].slice(-12);
  writeJsonStorage(backlinkProfileHistoryKey(projectId), next);
  return next;
};

export const loadBacklinkGapReport = (projectId: string): BacklinkGapReport | null => {
  return parseBacklinkGapReport(readProjectResearch(backlinkGapReportKey, projectId));
};

export const saveDomainComparison = (projectId: string, comparison: DomainComparisonData | null, targets: string[]) => {
  if (comparison) writeJsonStorage(domainComparisonKey(projectId), comparison);
  writeJsonStorage(domainComparisonTargetsKey(projectId), targets.slice(0, 5));
};

export const saveDomainComparisonSnapshot = (projectId: string, comparison: DomainComparisonData, targets: string[], history: DomainComparisonHistory) => {
  const nextHistory = [...history.filter((item) => item.retrieved_at !== comparison.retrieved_at), comparison].slice(-12);
  saveDomainComparison(projectId, comparison, targets);
  writeJsonStorage(domainComparisonHistoryKey(projectId), nextHistory);
  return nextHistory;
};