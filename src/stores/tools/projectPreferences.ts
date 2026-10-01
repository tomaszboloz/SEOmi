import { readJsonRecord } from '@/services/storageContracts';

import { GscPerformanceFilters } from '@/types';

import { readJsonStorage, readStorage, writeJsonStorage, writeStorage } from '@/services/storage';

import { dataForSeoLanguage, normalizeDataForSeoDomain, resolveDataForSeoMarket } from '@/services/dataforseo';

import { useProjectStore } from '../projectStore';

import { domainCountryKey, domainLanguageKey, keywordQueryKey, keywordCountryKey, keywordLanguageKey, activeProjectId } from './storageKeys';

export const backlinkGapSettingsKey = (projectId: string) => `seomi_backlink_gap_settings_${projectId}`;

export const gscClientIdKey = (projectId: string) => `seomi_gsc_client_id_${projectId}`;

export const gscClientSecretKey = (projectId: string) => `gsc_client_secret_${projectId}`;

export const gscPropertyKey = (projectId: string) => `seomi_gsc_property_${projectId}`;

export const gscFiltersKey = (projectId: string) => `seomi_gsc_filters_${projectId}_v1`;

export const DEFAULT_GSC_FILTERS: GscPerformanceFilters = {};

export const readGscFilters = (projectId: string): GscPerformanceFilters => {
  const stored = readJsonStorage(gscFiltersKey(projectId), null);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_GSC_FILTERS };
  const value = stored as Record<string, unknown>;
  return {
    ...(typeof value.search_type === 'string' ? { search_type: value.search_type as GscPerformanceFilters['search_type'] } : {}),
    ...(typeof value.device === 'string' ? { device: value.device as GscPerformanceFilters['device'] } : {}),
    ...(typeof value.country === 'string' ? { country: value.country.toLowerCase().slice(0, 3) } : {}),
  };
};

export const projectRootDomain = (projectId: string): string => {
  const rootUrl = useProjectStore.getState().projects.find((project) => project.id === projectId)?.rootUrl || '';
  if (!rootUrl.trim()) return '';
  try {
    return normalizeDataForSeoDomain(rootUrl);
  } catch {
    // Project validation already guards normal project URLs. Preserve a
    // readable value if an older project record cannot be normalized.
    return rootUrl.trim();
  }
};

export const projectDefaultMarket = (projectId: string): string => {
  const configured = readStorage(`seomi_project_${projectId}_dataforseo_market_v1`);
  if (configured && resolveDataForSeoMarket(configured)) return configured;
  const domain = projectRootDomain(projectId).toLowerCase();
  const candidates = domain.split('.');
  const suffix = candidates.length > 1 ? candidates[candidates.length - 1] : '';
  const byTld = resolveDataForSeoMarket(suffix);
  return byTld?.code || 'US';
};

export const loadProjectQuery = (key: (projectId: string) => string, projectId: string): string => {
  const stored = readStorage(key(projectId));
  // An empty string is intentional (the user may clear the field), therefore
  // only a missing key falls back to the project's root domain.
  return stored === null ? projectRootDomain(projectId) : stored;
};

export const saveProjectQuery = (key: (projectId: string) => string, value: string, projectId = activeProjectId()): void => {
  if (projectId) writeStorage(key(projectId), value.trim());
};

export const loadKeywordQuery = (projectId: string): string => readStorage(keywordQueryKey(projectId)) ?? '';

export const loadKeywordCountry = (projectId: string): string => {
  const stored = readStorage(keywordCountryKey(projectId));
  return stored ? (resolveDataForSeoMarket(stored)?.code || projectDefaultMarket(projectId)) : projectDefaultMarket(projectId);
};

export const loadKeywordLanguage = (projectId: string): string => {
  const country = loadKeywordCountry(projectId);
  return dataForSeoLanguage(country, readStorage(keywordLanguageKey(projectId)) || undefined);
};

export const loadDomainCountry = (projectId: string): string => {
  const stored = readStorage(domainCountryKey(projectId));
  return stored ? (resolveDataForSeoMarket(stored)?.code || projectDefaultMarket(projectId)) : projectDefaultMarket(projectId);
};

export const loadDomainLanguage = (projectId: string): string => {
  const country = loadDomainCountry(projectId);
  return dataForSeoLanguage(country, readStorage(domainLanguageKey(projectId)) || undefined);
};

export const loadBacklinkGapSettings = (projectId: string): { competitors: string[]; includeSubdomains: boolean } => {
  const value = readJsonRecord(backlinkGapSettingsKey(projectId));
  return {
    competitors: Array.isArray(value?.competitors) ? value.competitors.filter((domain: unknown): domain is string => typeof domain === 'string').slice(0, 19) : [],
    includeSubdomains: typeof value?.includeSubdomains === 'boolean' ? value.includeSubdomains : true,
  };
};

export const saveBacklinkGapSettings = (competitors: string[], includeSubdomains: boolean) => {
  const projectId = activeProjectId();
  if (!projectId) return;
  writeJsonStorage(backlinkGapSettingsKey(projectId), { competitors: competitors.slice(0, 19), includeSubdomains });
};