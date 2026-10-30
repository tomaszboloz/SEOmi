import { describe, expect, it } from 'vitest';
import { COMPLETE, artifactKey, availability, combineInputs, contentHash, envelope, type ReportEnvelope } from '@/services/analysisContracts';

const base = { projectId: 'p1', runId: 'r1', module: 'sfs', algorithmVersion: 1, generatedAt: '2026-10-30T00:00:00Z' };
const keyInput = { projectId: 'p1', kind: 'embedding', content: 'glukometr', modelId: 'nomic', language: 'pl', market: 'PL', profileId: null, algorithmVersion: 1 };

describe('analysis envelope (#85)', () => {
  it('keeps a measured 0 and turns a missing value into unavailable null', () => {
    expect(envelope({ ...base, value: 0 })).toMatchObject({ value: 0, availability: COMPLETE, profileId: null, modelId: null, contentHash: null });
    expect(envelope({ ...base, value: null }).availability).toEqual({ status: 'unavailable', reason: 'no-value', coverage: null });
    expect(envelope({ ...base, value: undefined }).value).toBeNull();
  });

  it('drops the value for error, cancelled and unavailable but keeps partial and stale', () => {
    expect(envelope({ ...base, value: 42, availability: availability('error', 'boom') }).value).toBeNull();
    expect(envelope({ ...base, value: 42, availability: availability('cancelled') })).toMatchObject({ value: null, availability: { reason: 'cancelled' } });
    expect(envelope({ ...base, value: 42, availability: availability('partial', 'sample', 0.4) })).toMatchObject({ value: 42, availability: { coverage: 0.4 } });
    expect(envelope({ ...base, value: 42, availability: availability('stale', 'old-run', 7) }).availability.coverage).toBe(1);
    expect(availability('partial', null, Number.NaN)).toEqual({ status: 'partial', reason: 'partial', coverage: null });
    expect(availability('complete', 'ignored', 0.2)).toEqual(COMPLETE);
  });
});

describe('DAG guard (#85 GEM-85-06)', () => {
  const sfs = envelope({ ...base, value: 70 });
  const tas = envelope({ ...base, module: 'tas', value: 55 });

  it('passes one project and one run as complete', () => {
    expect(combineInputs([sfs, tas])).toEqual({ availability: COMPLETE, runId: 'r1', projectId: 'p1' });
    expect(combineInputs([envelope({ ...base, runId: null, value: 1 })]).runId).toBeNull();
  });

  it('refuses mixed runs or projects and reports no inputs as unavailable', () => {
    expect(combineInputs([sfs, envelope({ ...base, runId: 'r2', value: 1 })]).availability).toMatchObject({ status: 'error', reason: 'mixed-runs' });
    expect(combineInputs([sfs, envelope({ ...base, projectId: 'p2', value: 1 })])).toMatchObject({ availability: { reason: 'mixed-projects' }, projectId: null });
    expect(combineInputs([]).availability).toEqual({ status: 'unavailable', reason: 'no-inputs', coverage: 0 });
  });

  it('propagates the worst upstream status with its module and measured share', () => {
    const cancelled: ReportEnvelope<number> = envelope({ ...base, module: 'aio', value: 3, availability: availability('cancelled', 'user') });
    const stale = envelope({ ...base, module: 'eetv', value: 3, availability: availability('stale', 'old') });
    expect(combineInputs([sfs, stale, cancelled]).availability).toEqual({ status: 'cancelled', reason: 'aio:user', coverage: 2 / 3 });
    expect(combineInputs([sfs, stale]).availability.status).toBe('stale');
  });
});

describe('parse-once cache key (#85 GEM-85-04)', () => {
  it('hashes content deterministically', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
    expect(contentHash('')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes when model, language, market, profile, version or project change', () => {
    const key = artifactKey(keyInput);
    expect(artifactKey({ ...keyInput, modelId: 'other' })).not.toBe(key);
    expect(artifactKey({ ...keyInput, language: 'en' })).not.toBe(key);
    expect(artifactKey({ ...keyInput, market: 'DE' })).not.toBe(key);
    expect(artifactKey({ ...keyInput, profileId: 'ymyl' })).not.toBe(key);
    expect(artifactKey({ ...keyInput, algorithmVersion: 2 })).not.toBe(key);
    expect(artifactKey({ ...keyInput, projectId: 'p2' })).not.toBe(key);
    expect(artifactKey({ ...keyInput, modelId: ' NOMIC ' })).toBe(key);
    expect(() => artifactKey({ ...keyInput, projectId: ' ' })).toThrow('Project ID');
  });
});
