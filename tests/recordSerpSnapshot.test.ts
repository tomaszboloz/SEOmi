import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clusterKeywordsByEmbedding } from '@/services/embeddingClustering';
import { recordSerpSnapshot } from '@/services/semanticDecay/recordSerpSnapshot';
import { loadSerpHistory, readSerpHistories } from '@/services/semanticDecay/snapshotStore';
import { hybridRun, importedSnapshot } from './fixtures/decayHistory';

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('real hybrid SERP snapshot producer', () => {
  it('records the actual offline hybrid result without inventing unavailable semantic fields', async () => {
    const snapshots = [importedSnapshot(), importedSnapshot({}, 'other')];
    const run = await clusterKeywordsByEmbedding(['query', 'other'], { provider: 'local', serpSnapshots: snapshots });
    expect(recordSerpSnapshot('p1', run, snapshots)).toBe(2);
    const history = loadSerpHistory('p1', { query: 'query', country: 'PL', language: 'pl' });
    expect(history.snapshots[0]).toMatchObject({
      query: 'query', country: 'PL', language: 'pl', provider: 'fixture', model: run.model,
      takenAt: snapshots[0].source.capturedAt, k: 10, centroid: null, consensusEntities: [],
      dominantIntent: null, dominantFormat: null, docs: snapshots[0].rows,
    });
    expect(Object.keys(readSerpHistories('p1'))).toHaveLength(2);
  });

  it('includes clustered keywords and normalizes their query matching', () => {
    const run = hybridRun({ clusters: [{ id: 'c1', keywords: ['QUERY', 'other'], label: 'not an entity', cohesion: 1 }], unclusteredKeywords: [] });
    expect(recordSerpSnapshot('p1', run, [importedSnapshot({}, '  Ｑｕｅｒｙ ')] )).toBe(1);
    expect(loadSerpHistory('p1').snapshots[0].consensusEntities).toEqual([]);
  });

  it('does not duplicate an imported observation on another clustering run', () => {
    expect(recordSerpSnapshot('p1', hybridRun(), [importedSnapshot()])).toBe(1);
    expect(recordSerpSnapshot('p1', hybridRun({ analyzedAt: '2026-10-25T12:00:00Z' }), [importedSnapshot()])).toBe(0);
    expect(loadSerpHistory('p1').snapshots).toHaveLength(1);
  });

  it('uses retrieval time, then real analysis time, when capture time is absent', () => {
    recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({ capturedAt: null })]);
    recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({ capturedAt: null, retrievedAt: null })]);
    expect(loadSerpHistory('p1').snapshots.map((snapshot) => snapshot.takenAt))
      .toEqual(['2026-10-02T12:00:00.000Z', '2026-10-24T12:00:00.000Z']);
  });

  it('preserves missing provenance rather than substituting an invented country, language, or provider', () => {
    recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({ countryCode: null, languageCode: null, provider: null })]);
    expect(loadSerpHistory('p1').snapshots[0]).toMatchObject({ country: '', language: '', provider: '', centroid: null });
  });

  it('separates incompatible location contexts through the real source profile', () => {
    recordSerpSnapshot('p1', hybridRun(), [importedSnapshot()]);
    recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({ locationCode: 2840 })]);
    const profiles = loadSerpHistory('p1').snapshots.map((snapshot) => snapshot.profile);
    expect(new Set(profiles).size).toBe(2);
  });

  it.each(['partial', 'blocked', 'missing'] as const)('does not record %s SERP evidence', (availability) => {
    expect(recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({ availability })])).toBe(0);
  });

  it('skips unrelated keywords and empty result rows', () => {
    expect(recordSerpSnapshot('p1', hybridRun(), [importedSnapshot({}, 'absent'), { ...importedSnapshot(), rows: [] }])).toBe(0);
    expect(readSerpHistories('p1')).toEqual({});
  });

  it('ignores an absent project, invalid run, or semantic-only run', () => {
    expect(recordSerpSnapshot(null, hybridRun(), [importedSnapshot()])).toBe(0);
    expect(recordSerpSnapshot('p1', hybridRun({ threshold: -1 }), [importedSnapshot()])).toBe(0);
    expect(recordSerpSnapshot('p1', hybridRun({ scoringMode: 'semantic-only' }), [importedSnapshot()])).toBe(0);
    expect(recordSerpSnapshot('p1', hybridRun({ scoringMode: undefined }), [importedSnapshot()])).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('keeps clustering output intact when storage is full or timestamps are invalid', () => {
    const run = hybridRun();
    const original = structuredClone(run);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(recordSerpSnapshot('p1', run, [importedSnapshot()])).toBe(0);
    expect(run).toEqual(original);
    expect(recordSerpSnapshot('p1', run, [importedSnapshot({ capturedAt: 'invalid' })])).toBe(0);
  });
});
