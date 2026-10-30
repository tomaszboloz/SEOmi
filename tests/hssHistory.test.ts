import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeHss, HSS_HISTORY_LIMIT, hssSnapshot, hssTrend, loadHssHistory, recordHssRun, type HssModuleInput } from '@/services/hss';

const KEY = 'seomi_project_p1_hss_history_v1';
const four: HssModuleInput[] = [{ module: 'sfs', value: 80 }, { module: 'tas', value: 60 }, { module: 'eetv', value: 70 }, { module: 'aior', value: 90 }];
const run = (runId: string, patch: HssModuleInput[] = []) => computeHss([...four.filter((item) => !patch.some((p) => p.module === item.module)), ...patch], runId);

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('HSS history (#72) in the shared envelope (#106)', () => {
  it('stores one envelope per run with project, run, profile and status, newest first, idempotent per run', () => {
    recordHssRun('p1', run('r1'), '2026-10-01T00:00:00Z');
    recordHssRun('p1', run('r2'), '2026-10-02T00:00:00Z');
    const rows = recordHssRun('p1', run('r1', [{ module: 'sfs', value: 10 }]), '2026-10-01T00:00:00Z');
    expect(rows.map((row) => row.runId)).toEqual(['r2', 'r1']);
    expect(rows[1]).toMatchObject({ projectId: 'p1', module: 'hss', profileId: 'hss-gemini-7', algorithmVersion: 1, availability: { status: 'partial', reason: 'partial-coverage' } });
    expect(rows[1].value?.modules).toMatchObject({ sfs: 10, igos: null });
    expect(loadHssHistory('p1')).toHaveLength(2);
  });

  it('skips unsaved runs, missing project and unavailable HSS; caps history', () => {
    expect(recordHssRun(null, run('r1'), 'x')).toEqual([]);
    expect(recordHssRun('p1', run('unsaved'), '2026-10-01')).toEqual([]);
    expect(recordHssRun('p1', computeHss([], 'r9'), '2026-10-01')).toEqual([]);
    for (let index = 0; index < HSS_HISTORY_LIMIT + 3; index += 1) recordHssRun('p1', run(`r${index}`), `2026-01-01T00:00:${String(index).padStart(2, '0')}Z`);
    expect(loadHssHistory('p1')).toHaveLength(HSS_HISTORY_LIMIT);
    expect(loadHssHistory(undefined)).toEqual([]);
  });

  it('maps complete and insufficient status and drops damaged rows', () => {
    const all = computeHss([...four, { module: 'igos', value: 1 }, { module: 'sprs', value: 1 }, { module: 'sija', value: 1 }], 'c');
    expect(hssSnapshot('p1', all, 't').availability.status).toBe('complete');
    const low = hssSnapshot('p1', computeHss([{ module: 'sfs', value: 50 }], 'i'), 't');
    expect(low.availability).toMatchObject({ status: 'partial', reason: 'insufficient-coverage' });
    expect(low.value?.hss).toBeNull();
    localStorage.setItem(KEY, JSON.stringify([{ module: 'hss' }, 3, low]));
    expect(loadHssHistory('p1')).toHaveLength(1);
    localStorage.setItem(KEY, JSON.stringify({ not: 'an array' }));
    expect(loadHssHistory('p1')).toEqual([]);
  });

  it('falls back to stored rows when the write fails', () => {
    recordHssRun('p1', run('r1'), '2026-10-01');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(recordHssRun('p1', run('r2'), '2026-10-02').map((row) => row.runId)).toEqual(['r1']);
  });
});

describe('HSS trend (#72 GEM-72-T05, #73)', () => {
  it('compares with the newest earlier run of the same profile, per module only when measured in both', () => {
    const history = [hssSnapshot('p1', run('r1', [{ module: 'aior', value: null, reason: 'x' }]), '2026-10-01'), hssSnapshot('p1', run('r0'), '2026-09-01')];
    const trend = hssTrend(run('r2', [{ module: 'sfs', value: 90 }]), history, '2026-10-05');
    expect(trend?.previous.runId).toBe('r1');
    expect(trend?.modules).toMatchObject({ sfs: 10, aior: null, igos: null, eetv: 0 });
    expect(typeof trend?.hss).toBe('number');
  });

  it('has no trend for the first run, later runs, the same run or another profile', () => {
    const current = run('r2');
    expect(hssTrend(current, [], '2026-10-05')).toBeNull();
    expect(hssTrend(current, [hssSnapshot('p1', run('r3'), '2026-11-01')], '2026-10-05')).toBeNull();
    expect(hssTrend(current, [hssSnapshot('p1', current, '2026-10-01')], '2026-10-05')).toBeNull();
    const other = { ...hssSnapshot('p1', run('r1'), '2026-10-01'), profileId: 'hss-next' };
    expect(hssTrend(current, [other], '2026-10-05')).toBeNull();
    const withheld = hssTrend(computeHss([{ module: 'sfs', value: 1 }], 'r4'), [hssSnapshot('p1', run('r1'), '2026-10-01')], '2026-10-05');
    expect(withheld?.hss).toBeNull();
  });
});
