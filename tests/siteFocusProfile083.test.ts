import { afterEach, describe, expect, it } from 'vitest';
import {
  annotateChange, bandFor, breakAnnotations, buildSiteFocusReport, comparableSfsProfiles, comparableSnapshots, evaluateAlerts, focusConfigHash,
  makeSnapshot, SFS_ALGORITHM_VERSION, SFS_BANDS, SFS_CONFIG_HASH, SFS_PROFILE_ID, SFS_TRS_SCALE, sfsProfile, trsGroup, type SfsSnapshot,
} from '@/services/siteFocus';
import { focusAlertEvents } from '@/services/monitoringAlerts/focus';
import { historyRunId, readFocusHistory, recordFullAnalysis } from '@/services/siteFocusMonitoring';
import { diabetesSite } from './siteFocusFixtures';

const START = 'https://diabetes.test/';
const build = (manualTopic?: string) => buildSiteFocusReport(diabetesSite(), START, { language: 'en', manualTopic, now: '2026-10-30T00:00:00Z' });
const snap = (score: number, extra: Partial<SfsSnapshot> = {}): SfsSnapshot => ({
  runId: 'r', at: '2026-10-01T00:00:00Z', score, pageCount: 1, coreTopic: { label: 'a', clusterId: 'c' }, clusterLabels: [], pages: {}, ...extra,
});

afterEach(() => localStorage.clear());

describe('versioned Site Focus profile (#83)', () => {
  it('keeps the 0.3.0 constants as the accepted baseline with a stable config hash', () => {
    expect(SFS_TRS_SCALE).toBe(125);
    expect(SFS_BANDS).toEqual({ excellent: 90, good: 75, moderate: 60, weak: 40 });
    expect(SFS_CONFIG_HASH).toMatch(/^fnv1a-[0-9a-f]{8}$/);
    const profile = sfsProfile('pl');
    expect(profile).toMatchObject({ id: SFS_PROFILE_ID, algorithmVersion: SFS_ALGORITHM_VERSION, configHash: SFS_CONFIG_HASH, language: 'pl', trsScale: 125 });
    expect(profile.model).toEqual({ provider: 'local', name: 'lexical-tfidf', dimensions: null, normalization: 'sublinear-tf-idf' });
    expect(sfsProfile('').language).toBe('und');
  });

  it('classifies every band and TRS boundary on its own (GEM-83-T03)', () => {
    expect([90, 89.9, 75, 74.9, 60, 59.9, 40, 39.9].map(bandFor)).toEqual(['excellent', 'good', 'good', 'moderate', 'moderate', 'weak', 'weak', 'critical']);
    expect([39.99, 40, 74.99, 75].map(trsGroup)).toEqual(['off-topic', 'borderline', 'borderline', 'strong']);
  });

  it('stamps every report and snapshot with the profile and the Core Topic config hash', () => {
    const report = build();
    expect(report.profile).toEqual({ id: SFS_PROFILE_ID, algorithmVersion: SFS_ALGORITHM_VERSION, configHash: SFS_CONFIG_HASH });
    expect(report.coreConfigHash).toBe(focusConfigHash({}));
    const snapshot = makeSnapshot(report, 'run-1');
    expect(snapshot.profile).toEqual(report.profile);
    expect(snapshot.coreConfigHash).toBe(report.coreConfigHash);
    expect(build('insulin').coreConfigHash).not.toBe(report.coreConfigHash);
  });

  it('only compares snapshots of the same profile and configuration (GEM-83-16)', () => {
    const profile = { id: SFS_PROFILE_ID, algorithmVersion: SFS_ALGORITHM_VERSION, configHash: SFS_CONFIG_HASH };
    expect(comparableSfsProfiles(profile, profile)).toBe(true);
    expect(comparableSfsProfiles(undefined, profile)).toBe(false);
    expect(comparableSfsProfiles(profile, { ...profile, configHash: 'other' })).toBe(false);
    expect(comparableSnapshots(snap(1), snap(2))).toBe(true);
    expect(comparableSnapshots(snap(1), snap(2, { profile, coreConfigHash: 'x' }))).toBe(false);
    expect(comparableSnapshots(snap(1, { profile, coreConfigHash: 'x' }), snap(2, { profile, coreConfigHash: 'x' }))).toBe(true);
    expect(comparableSnapshots(snap(1, { profile, coreConfigHash: 'x' }), snap(2, { profile, coreConfigHash: 'y' }))).toBe(false);
  });

  it('marks profile and configuration breaks in history and never alerts across them', () => {
    const profile = { id: SFS_PROFILE_ID, algorithmVersion: SFS_ALGORITHM_VERSION, configHash: SFS_CONFIG_HASH };
    const legacy = snap(80);
    const next = snap(60, { profile, coreConfigHash: 'x' });
    expect(breakAnnotations(legacy, next)).toEqual([{ code: 'profile-changed', params: { from: 'legacy', to: SFS_ALGORITHM_VERSION }, delta: -20 }]);
    expect(breakAnnotations(snap(80, { profile, coreConfigHash: 'y' }), next)).toEqual([{ code: 'config-changed', params: {}, delta: -20 }]);
    expect(breakAnnotations(legacy, snap(70))).toEqual([]);
    expect(annotateChange(legacy, next).map((note) => note.code)).toContain('profile-changed');
    expect(evaluateAlerts(legacy, next)).toEqual([]);
    expect(focusAlertEvents(legacy, next)).toEqual([]);
    expect(evaluateAlerts(snap(80), snap(60)).map((event) => event.code)).toEqual(['sfs-drop']);
  });
});

describe('report versions in history (#82 GEM-82-07)', () => {
  it('keeps the first version of a run and adds a versioned entry for a new configuration', () => {
    const auto = build();
    const manual = build('insulin');
    expect(recordFullAnalysis('p1', auto, 'run-1', { notify: false }).saved).toBe(true);
    expect(historyRunId(readFocusHistory('p1'), auto, 'run-1')).toBe('run-1');
    const second = recordFullAnalysis('p1', manual, 'run-1', { notify: false });
    expect(second.saved).toBe(true);
    expect(second.snapshot.runId).toBe(`run-1:v:${SFS_CONFIG_HASH}:${manual.coreConfigHash}`);
    expect(second.entries[1].annotations.map((note) => note.code)).toContain('config-changed');
    expect(recordFullAnalysis('p1', auto, 'run-1', { notify: false }).saved).toBe(false);
    expect(readFocusHistory('p1').map((entry) => entry.snapshot.score)).toEqual([auto.score, manual.score]);
  });
});
