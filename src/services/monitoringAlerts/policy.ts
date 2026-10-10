import { validProjectId } from '@/services/schedules/policy';
import type { MonitoringAlert, MonitoringAlertFrequency, MonitoringAlertSettings, MonitoringAlertType } from './types';

export const MONITORING_HISTORY_LIMIT = 128;
export const defaultMonitoringAlertSettings = (): MonitoringAlertSettings => ({
  enabled: false,
  frequency: 'daily',
  types: { gsc: true, pagespeed: true, crawl: true, semantic: true },
  thresholds: {
    gsc: { declinePercent: 20, minImpressions: 100 },
    pagespeed: { categoryDrop: 0.1, metricIncrease: 250, maxWindowDays: 35 },
    crawl: { changedPages: 1 },
    semantic: { changes: 1 },
  },
});

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
};
export const normalizeMonitoringSettings = (value: unknown): MonitoringAlertSettings => {
  const defaults = defaultMonitoringAlertSettings();
  const raw = value && typeof value === 'object' ? value as Partial<MonitoringAlertSettings> : {};
  const thresholds = raw.thresholds && typeof raw.thresholds === 'object' ? raw.thresholds : {};
  const read = (key: MonitoringAlertType) => raw.types && typeof raw.types === 'object' && typeof raw.types[key] === 'boolean' ? raw.types[key] : defaults.types[key];
  const gsc = ((thresholds as Partial<MonitoringAlertSettings['thresholds']>).gsc || {}) as Partial<MonitoringAlertSettings['thresholds']['gsc']>;
  const psi = ((thresholds as Partial<MonitoringAlertSettings['thresholds']>).pagespeed || {}) as Partial<MonitoringAlertSettings['thresholds']['pagespeed']>;
  const crawl = ((thresholds as Partial<MonitoringAlertSettings['thresholds']>).crawl || {}) as Partial<MonitoringAlertSettings['thresholds']['crawl']>;
  const semantic = ((thresholds as Partial<MonitoringAlertSettings['thresholds']>).semantic || {}) as Partial<MonitoringAlertSettings['thresholds']['semantic']>;
  const frequency: MonitoringAlertFrequency = raw.frequency === 'run' || raw.frequency === 'weekly' ? raw.frequency : 'daily';
  return {
    enabled: raw.enabled === true,
    frequency,
    types: { gsc: read('gsc'), pagespeed: read('pagespeed'), crawl: read('crawl'), semantic: read('semantic') },
    thresholds: {
      gsc: { declinePercent: finite(gsc.declinePercent, 20, 1, 100), minImpressions: finite(gsc.minImpressions, 100, 1, 1_000_000) },
      pagespeed: { categoryDrop: finite(psi.categoryDrop, 0.1, 0.01, 1), metricIncrease: finite(psi.metricIncrease, 250, 1, 60_000), maxWindowDays: finite(psi.maxWindowDays, 35, 1, 366) },
      crawl: { changedPages: Math.ceil(finite(crawl.changedPages, 1, 1, 10_000)) },
      semantic: { changes: Math.ceil(finite(semantic.changes, 1, 1, 10_000)) },
    },
  };
};

export const monitoringSettingsKey = (projectId: string) => `seomi_project_${projectId}_monitoring_alert_settings_v1`;
export const monitoringHistoryKey = (projectId: string) => `seomi_project_${projectId}_monitoring_alert_history_v1`;
export const validMonitoringProject = (projectId: string) => validProjectId(projectId);

export const alertFingerprint = (type: MonitoringAlertType, sourceId: string, evidence: Record<string, unknown> = {}) => {
  const canonical = Object.entries(evidence).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${String(value)}`).join('&');
  return [type, sourceId.trim(), canonical].map(encodeURIComponent).join('|');
};
export const frequencyWindowMs = (frequency: MonitoringAlertFrequency): number => frequency === 'weekly' ? 7 * 86_400_000 : frequency === 'daily' ? 86_400_000 : 0;
export const validAlert = (value: unknown): value is MonitoringAlert => Boolean(value && typeof value === 'object'
  && ['gsc', 'pagespeed', 'crawl', 'semantic'].includes((value as MonitoringAlert).type)
  && typeof (value as MonitoringAlert).fingerprint === 'string' && typeof (value as MonitoringAlert).sourceId === 'string'
  && typeof (value as MonitoringAlert).title === 'string' && typeof (value as MonitoringAlert).body === 'string'
  && typeof (value as MonitoringAlert).occurredAt === 'string');
