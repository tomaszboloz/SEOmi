import i18n from '@/i18n';
import { alertFingerprint, defaultMonitoringAlertSettings } from './policy';
import type { MonitoringAlert, MonitoringAlertSettings } from './types';

const SAMPLE = 3;

/**
 * #68 (GEM-68-06): TOP set of a phrase changed between two comparable runs (same provider and model).
 * Threshold is the shared `semantic.changes` count of URLs added plus removed. Informational: the score
 * is not comparable across a changed TOP set, so no drop alert is raised for that pair.
 */
export const evaluateTopSetChangeAlert = (
  previousUrls: string[],
  currentUrls: string[],
  sourceId: string,
  phrase: string,
  settings: MonitoringAlertSettings = defaultMonitoringAlertSettings(),
): MonitoringAlert | null => {
  const before = new Set(previousUrls);
  const after = new Set(currentUrls);
  const added = [...after].filter((url) => !before.has(url));
  const removed = [...before].filter((url) => !after.has(url));
  const changed = added.length + removed.length;
  if (changed < settings.thresholds.semantic.changes) return null;
  const evidence: MonitoringAlert['evidence'] = {
    kind: 'igos-top-change', added: added.length, removed: removed.length,
    addedSample: added.slice(0, SAMPLE).join(' '), removedSample: removed.slice(0, SAMPLE).join(' '),
  };
  return {
    type: 'semantic',
    sourceId,
    title: i18n.t('scoreDropAlert.igosTopChange.title'),
    body: i18n.t('scoreDropAlert.igosTopChange.body', { phrase, added: added.length, removed: removed.length }),
    occurredAt: new Date().toISOString(),
    partial: false,
    evidence,
    fingerprint: alertFingerprint('semantic', sourceId, evidence),
  };
};
