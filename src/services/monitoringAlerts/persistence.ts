import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { normalizeMonitoringSettings, monitoringHistoryKey, monitoringSettingsKey, MONITORING_HISTORY_LIMIT, validAlert, validMonitoringProject, frequencyWindowMs } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

const pending = new Set<string>();
type DeliveredScope = 'fingerprint' | 'type';
interface DeliveredCacheEntry { key: string; scope: DeliveredScope; deliveredAt: number; }
const deliveredCache = new Map<string, DeliveredCacheEntry[]>();
const pendingKey = (projectId: string, kind: string, value: string) => `${projectId}\0${kind}\0${value}`;
const cached = (projectId: string, keys: string[], frequency: MonitoringAlertSettings['frequency']) => {
  const cutoff = Date.now() - frequencyWindowMs(frequency);
  return (deliveredCache.get(projectId) || []).some((entry) => keys.includes(entry.key)
    && (entry.scope === 'fingerprint' || entry.deliveredAt >= cutoff));
};
const rememberDelivered = (projectId: string, entriesToRemember: DeliveredCacheEntry[]) => {
  const entries = deliveredCache.get(projectId) || [];
  entriesToRemember.forEach((entry) => {
    const index = entries.findIndex((current) => current.key === entry.key);
    if (index >= 0) entries.splice(index, 1);
    entries.push(entry);
  });
  deliveredCache.delete(projectId);
  deliveredCache.set(projectId, entries.slice(-MONITORING_HISTORY_LIMIT));
  while (deliveredCache.size > MONITORING_HISTORY_LIMIT) {
    const oldest = deliveredCache.keys().next().value;
    if (typeof oldest !== 'string') break;
    deliveredCache.delete(oldest);
  }
};
export const readMonitoringSettings = (projectId: string): MonitoringAlertSettings =>
  normalizeMonitoringSettings(readJsonStorage(monitoringSettingsKey(projectId), null));
export const saveMonitoringSettings = (projectId: string, value: unknown): boolean =>
  validMonitoringProject(projectId) && writeJsonStorage(monitoringSettingsKey(projectId), normalizeMonitoringSettings(value));
export const readMonitoringHistory = (projectId: string): MonitoringAlert[] => {
  if (!validMonitoringProject(projectId)) return [];
  const value = readJsonStorage(monitoringHistoryKey(projectId), []);
  return (Array.isArray(value) ? value.filter(validAlert) : []).slice(-MONITORING_HISTORY_LIMIT);
};

export interface MonitoringReservation { duplicate: boolean; finish: (delivered: boolean) => boolean; }
export const reserveMonitoringAlert = (projectId: string, alert: MonitoringAlert, settings = readMonitoringSettings(projectId)): MonitoringReservation | null => {
  if (!validMonitoringProject(projectId) || !settings.enabled || !settings.types[alert.type]) return null;
  const history = readMonitoringHistory(projectId);
  const fingerprintKey = pendingKey(projectId, 'fingerprint', alert.fingerprint);
  const typeKey = pendingKey(projectId, 'type', alert.type);
  const reservationKeys = settings.frequency === 'run' ? [fingerprintKey] : [fingerprintKey, typeKey];
  const cacheEntries: DeliveredCacheEntry[] = settings.frequency === 'run'
    ? [{ key: fingerprintKey, scope: 'fingerprint', deliveredAt: Date.now() }]
    : [{ key: fingerprintKey, scope: 'fingerprint', deliveredAt: Date.now() }, { key: typeKey, scope: 'type', deliveredAt: Date.now() }];
  const cutoff = Date.now() - frequencyWindowMs(settings.frequency);
  const duplicate = cached(projectId, reservationKeys, settings.frequency) || reservationKeys.some((key) => pending.has(key)) || history.some((item) => item.fingerprint === alert.fingerprint
    || (settings.frequency !== 'run' && item.type === alert.type && Date.parse(item.occurredAt) >= cutoff));
  if (duplicate) return { duplicate: true, finish: () => false };
  reservationKeys.forEach((key) => pending.add(key));
  return {
    duplicate: false,
    finish: (delivered) => {
      reservationKeys.forEach((key) => pending.delete(key));
      if (!delivered) return false;
      rememberDelivered(projectId, cacheEntries.map((entry) => ({ ...entry, deliveredAt: Date.now() })));
      const current = readMonitoringHistory(projectId);
      if (current.some((item) => item.fingerprint === alert.fingerprint)) return true;
      return writeJsonStorage(monitoringHistoryKey(projectId), [...current, alert].slice(-MONITORING_HISTORY_LIMIT));
    },
  };
};
