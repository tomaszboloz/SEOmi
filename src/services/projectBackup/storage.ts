import { readStorage, readStorageEntries } from '@/services/storage';
import i18n from '@/i18n';
export const projectStoragePrefix = (projectId: string): string => `seomi_project_${projectId}_`;

export const projectBackupLegacyKeys = (projectId: string): string[] => [
  `seomi_gsc_client_id_${projectId}`,
  `seomi_gsc_property_${projectId}`,
  `seomi_gsc_filters_${projectId}_v1`,
  `seomi_keyword_clustering_${projectId}`,
  `seomi_pagespeed_workspace_${projectId}`,
  `seomi_performance_${projectId}`,
];

export const restoreProjectStorageKey = (suffix: string, sourceId: string, targetId: string): string => {
  if (!suffix.startsWith('__raw__')) return `${projectStoragePrefix(targetId)}${suffix}`;
  const index = projectBackupLegacyKeys(sourceId).indexOf(suffix.slice('__raw__'.length));
  if (index < 0) throw new Error(i18n.t('runtimeErrors.backup.entry'));
  return projectBackupLegacyKeys(targetId)[index];
};

export const readProjectStorage = (projectId: string): Record<string, string> => {
  const primary = readStorageEntries(projectStoragePrefix(projectId));
  for (const key of projectBackupLegacyKeys(projectId)) {
    const value = readStorage(key);
    if (value !== null) primary[`__raw__${key}`] = value;
  }
  return primary;
};

