import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultMonitoringAlertSettings, evaluateScoreDropAlert, monitoringSettingsKey,
  normalizeMonitoringSettings, readMonitoringSettings, saveMonitoringSettings, validAlert,
} from '@/services/monitoringAlerts';

beforeEach(() => localStorage.clear());
describe('AIO alert settings migration and thresholds', () => {
  it('defaults absent AIO keys in stored settings while preserving every older preference', () => {
    const legacy = { enabled: true, frequency: 'weekly', types: { focus: false, crawl: false }, thresholds: { focus: { dropPoints: 17 } } };
    localStorage.setItem(monitoringSettingsKey('legacy-aio'), JSON.stringify(legacy));
    const settings = readMonitoringSettings('legacy-aio');
    expect(settings).toMatchObject({ ...legacy, types: { ...legacy.types, aio: true }, thresholds: { ...legacy.thresholds, aio: { dropPoints: 10 } } });
    expect(saveMonitoringSettings('legacy-aio', settings)).toBe(true);
    expect(JSON.parse(localStorage.getItem(monitoringSettingsKey('legacy-aio'))!)).toEqual(settings);
    expect(readMonitoringSettings('untouched-aio')).toEqual(defaultMonitoringAlertSettings());
  });

  it.each([undefined, null, {}, { dropPoints: null }, { dropPoints: '12' }, { dropPoints: NaN }, { dropPoints: Infinity }])('defaults invalid AIO threshold %j', (aio) => {
    expect(normalizeMonitoringSettings({ thresholds: { aio } }).thresholds.aio.dropPoints).toBe(10);
  });

  it.each([[0, 0.5], [-10, 0.5], [200, 100], [7.5, 7.5]])('bounds %s points to %s', (input, expected) => {
    expect(normalizeMonitoringSettings({ types: { aio: false }, thresholds: { aio: { dropPoints: input } } })).toMatchObject({ types: { aio: false }, thresholds: { aio: { dropPoints: expected } } });
  });

  it.each([true, null, 'yes', 0])('defaults invalid AIO type flag %j', (aio) => {
    expect(normalizeMonitoringSettings({ types: { aio } }).types.aio).toBe(true);
  });

  it('uses an independent inclusive threshold without rounding up a subthreshold drop', () => {
    const settings = defaultMonitoringAlertSettings();
    settings.thresholds.focus.dropPoints = 100; settings.thresholds.aio.dropPoints = 7.5;
    const evaluate = (score: number) => evaluateScoreDropAlert('aio', { score: 80 }, { score }, 'aio-boundary', settings);
    expect(evaluate(72.5)).toMatchObject({ type: 'aio', evidence: { before: 80, after: 72.5, drop: 7.5 } });
    expect(validAlert(evaluate(72.5))).toBe(true);
    expect(evaluate(72.51)).toBeNull(); expect(evaluate(80)).toBeNull(); expect(evaluate(90)).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: 80 }, { score: 70.04 }, 'default-boundary')).toBeNull();
    expect(evaluateScoreDropAlert('aio', { score: 70.1 }, { score: 60.1 }, 'decimal-boundary')).toMatchObject({ type: 'aio', evidence: { drop: 10 } });
  });
});
