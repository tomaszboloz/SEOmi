import { beforeEach, describe, expect, it } from 'vitest';
import { historyEnvelope, historyEnvelopes } from '@/services/analysisContracts';
import { readAioHistory } from '@/services/aioReadiness/history';
import { TRUST_PROFILE_ID } from '@/services/eeatTrust/types';
import { readTrustHistory, trustHistoryKey } from '@/services/eeatTrust/history';
import { readFocusHistory, focusHistoryKey } from '@/services/siteFocusMonitoring';
import { authorityHistoryKey, readAuthorityHistory } from '@/services/topicalAuthorityMonitoring';

const P = 'proj1';
const put = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
beforeEach(() => localStorage.clear());

describe('history envelopes: characterization of stored shapes', () => {
  it('AIO snapshots with a profile are complete and keep the snapshot as the value', () => {
    put(`seomi_project_${P}_aio_readiness_history_v1`, [
      { runId: 'r1', at: '2026-01-01T00:00:00.000Z', score: 0, profile: { id: 'aio-pl', algorithmVersion: '3', configHash: 'h' } },
      { runId: 'r0', at: '2025-12-01T00:00:00.000Z', score: 41 },
    ]);
    const [modern, legacy] = historyEnvelopes('aio', P, readAioHistory(P));
    expect(modern).toMatchObject({ module: 'aio', runId: 'r1', profileId: 'aio-pl', algorithmVersion: 3, availability: { status: 'complete' } });
    expect(modern.value?.score).toBe(0);
    expect(legacy.availability).toMatchObject({ status: 'stale', reason: 'legacy-no-profile' });
    expect(legacy.value?.score).toBe(41);
  });

  it('SFS unavailable snapshots drop the score instead of reading as 0', () => {
    put(focusHistoryKey(P), [{
      annotations: [],
      snapshot: { runId: 's1', at: '2026-02-01T00:00:00.000Z', score: 0, unavailable: true, pageCount: 0, coreTopic: { label: 'x', clusterId: 'c' }, clusterLabels: [], pages: {}, profile: { id: 'sfs-1', algorithmVersion: '2', configHash: 'h' } },
    }]);
    const [entry] = readFocusHistory(P);
    const wrapped = historyEnvelope('sfs', P, entry.snapshot);
    expect(wrapped.availability).toMatchObject({ status: 'unavailable', reason: 'no-pages-scored', coverage: 0 });
    expect(wrapped.value).toBeNull();
  });

  it('TAS names tas as the headline score and null tas is unavailable', () => {
    const base = { at: '2026-03-01T00:00:00.000Z', sfs: 50, tcr: null, cdes: null, silc: null, cvff: null, index: 1, quadrant: null, pageCount: 3, pillars: {} };
    put(authorityHistoryKey(P), [
      { annotations: [], snapshot: { ...base, runId: 't1', tas: 62, profile: 'tas2|core|x' } },
      { annotations: [], snapshot: { ...base, runId: 't2', tas: null, profile: 'tas2|core|x' } },
    ]);
    const snaps = readAuthorityHistory(P).map((entry) => entry.snapshot);
    const [ok, missing] = historyEnvelopes('tas', P, snaps.map((s) => ({ ...s, score: s.tas })), (s) => s.tas);
    expect(ok).toMatchObject({ profileId: 'tas2|core|x', algorithmVersion: 0, availability: { status: 'complete' } });
    expect(missing.availability).toMatchObject({ status: 'unavailable', reason: 'score-not-finite' });
  });

  it('EETV uses profileId and falls back to stale for pre-profile snapshots', () => {
    put(trustHistoryKey(P), [
      { at: '2026-04-01T00:00:00.000Z', runId: 'e1', score: 70, layers: { experience: 70 } },
      { at: '2026-04-02T00:00:00.000Z', runId: 'e2', score: 71, layers: {}, profileVersion: 2, profileId: 'eetv-claim-v2' },
    ]);
    const [legacy, modern] = historyEnvelopes('eetv', P, readTrustHistory(P));
    expect(legacy.availability.status).toBe('stale');
    expect(modern.profileId).toBe(TRUST_PROFILE_ID);
  });

  it('treats blank and non-numeric profile markers as unknown', () => {
    const at = '2026-05-01T00:00:00.000Z';
    expect(historyEnvelope('aio', P, { runId: 'a', at, score: 1, profile: '  ' }).profileId).toBeNull();
    const odd = historyEnvelope('aio', P, { runId: 'b', at, score: 1, profile: { id: 'p', algorithmVersion: 'v-x' } });
    expect(odd.algorithmVersion).toBe(0);
    expect(odd.profileId).toBe('p');
  });
});
