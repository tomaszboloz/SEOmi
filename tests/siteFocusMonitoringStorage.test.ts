import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SfsSnapshot } from '@/services/siteFocus';
import {
  SFS_FULL_PAGES_KEPT, SFS_HISTORY_LIMIT, annotationsByRun, appendFocusHistory, consumeRecompute, dayOf,
  focusBudgetKey, focusHistoryKey, readFocusHistory, readManualTopic, readRecomputeBudget, registerSeenUrls, validFocusProject,
  writeManualTopic, type FocusHistoryEntry,
} from '@/services/siteFocusMonitoring';

const snap = (runId: string, at: string, score: number, pages: SfsSnapshot['pages'] = { 'https://a.test/': { trs: 80, weight: 1, type: 'article' } }): SfsSnapshot => ({
  runId, at, score, pageCount: Object.keys(pages).length, coreTopic: { label: 't', clusterId: 'c1' }, clusterLabels: ['t'], pages,
});
const entry = (runId: string, score = 50, at = '2026-10-01T00:00:00Z'): FocusHistoryEntry => ({ snapshot: snap(runId, at, score), annotations: [] });

describe('focus history storage', () => {
  beforeEach(() => localStorage.clear());

  it('rejects invalid projects and malformed stored data', () => {
    expect(validFocusProject('../x')).toBe(false);
    expect(validFocusProject(null)).toBe(false);
    expect(readFocusHistory('../x')).toEqual([]);
    localStorage.setItem(focusHistoryKey('p1'), '{"a":1}');
    expect(readFocusHistory('p1')).toEqual([]);
    localStorage.setItem(focusHistoryKey('p1'), JSON.stringify([null, [], { snapshot: null, annotations: [] }, { snapshot: { runId: 1 }, annotations: [] }, { snapshot: snap('a', 't', 1), annotations: 'x' }, entry('ok')]));
    expect(readFocusHistory('p1').map((item) => item.snapshot.runId)).toEqual(['ok']);
  });

  it('dedupes by runId, caps entries and drops old page maps', () => {
    expect(appendFocusHistory('p1', entry('r1')).saved).toBe(true);
    expect(appendFocusHistory('p1', entry('r1', 99))).toMatchObject({ saved: false });
    for (let i = 2; i <= SFS_HISTORY_LIMIT + 5; i += 1) appendFocusHistory('p1', entry(`r${i}`));
    const entries = readFocusHistory('p1');
    expect(entries).toHaveLength(SFS_HISTORY_LIMIT);
    expect(entries[0].snapshot.runId).toBe('r6');
    expect(Object.keys(entries[0].snapshot.pages)).toHaveLength(0);
    expect(entries.slice(-SFS_FULL_PAGES_KEPT).every((item) => Object.keys(item.snapshot.pages).length === 1)).toBe(true);
    expect(annotationsByRun(entries.slice(-1))).toEqual({ [`r${SFS_HISTORY_LIMIT + 5}`]: [] });
  });

  it('reports a failed write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(appendFocusHistory('p1', entry('r1')).saved).toBe(false);
    spy.mockRestore();
  });
});

describe('manual core topic override', () => {
  beforeEach(() => localStorage.clear());
  it('stores, normalizes and clears the override per project', () => {
    expect(readManualTopic(undefined)).toBeUndefined();
    expect(writeManualTopic('../x', 'a')).toBe(false);
    expect(writeManualTopic('p1', '  diabetes ')).toBe(true);
    expect(readManualTopic('p1')).toBe('diabetes');
    expect(readManualTopic('p2')).toBeUndefined();
    writeManualTopic('p1', [' insulin ', '', 'glucose']);
    expect(readManualTopic('p1')).toEqual(['insulin', 'glucose']);
    localStorage.setItem('seomi_project_p3_site_focus_manual_topic_v1', JSON.stringify([1, '']));
    expect(readManualTopic('p3')).toBeUndefined();
    localStorage.setItem('seomi_project_p3_site_focus_manual_topic_v1', '7');
    expect(readManualTopic('p3')).toBeUndefined();
    writeManualTopic('p1', null);
    expect(readManualTopic('p1')).toBeUndefined();
    writeManualTopic('p1', '   ');
    expect(readManualTopic('p1')).toBeUndefined();
  });
});

describe('daily recompute budget', () => {
  beforeEach(() => localStorage.clear());
  it('allows three recomputations per day and resets the next day (injected clock)', () => {
    let now = new Date(2026, 9, 15, 10, 0, 0).getTime();
    const clock = () => now;
    expect(dayOf(clock)).toBe('2026-10-15');
    expect(readRecomputeBudget('p1', clock)).toMatchObject({ used: 0, remaining: 3, limit: 3 });
    expect(consumeRecompute('p1', clock).allowed).toBe(true);
    expect(consumeRecompute('p1', clock).allowed).toBe(true);
    expect(consumeRecompute('p1', clock)).toMatchObject({ allowed: true, budget: { remaining: 0 } });
    expect(consumeRecompute('p1', clock)).toMatchObject({ allowed: false, budget: { used: 3 } });
    expect(readRecomputeBudget('p2', clock).remaining).toBe(3);
    now = new Date(2026, 9, 16, 0, 5, 0).getTime();
    expect(readRecomputeBudget('p1', clock).remaining).toBe(3);
    expect(consumeRecompute('p1', clock).allowed).toBe(true);
  });
  it('fails closed for invalid projects, corrupt data and unwritable storage', () => {
    expect(consumeRecompute(null)).toMatchObject({ allowed: false });
    expect(readRecomputeBudget('../x').remaining).toBe(0);
    localStorage.setItem(focusBudgetKey('p1'), JSON.stringify({ day: dayOf(), used: 'many' }));
    expect(readRecomputeBudget('p1').used).toBe(0);
    localStorage.setItem(focusBudgetKey('p1'), JSON.stringify({ day: dayOf(), used: -4 }));
    expect(readRecomputeBudget('p1').used).toBe(0);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('x'); });
    expect(consumeRecompute('p1').allowed).toBe(false);
    spy.mockRestore();
  });
});

describe('first-seen registry', () => {
  beforeEach(() => localStorage.clear());
  it('treats the first registration as baseline and flags later arrivals for 24 hours', () => {
    let now = 1_000_000;
    const clock = () => now;
    expect(registerSeenUrls('p1', ['a', 'b'], clock).size).toBe(0);
    now += 3_600_000;
    expect([...registerSeenUrls('p1', ['a', 'c'], clock)]).toEqual(['c']);
    now += 23 * 3_600_000;
    expect([...registerSeenUrls('p1', ['c'], clock)]).toEqual(['c']);
    now += 2 * 3_600_000;
    expect(registerSeenUrls('p1', ['c'], clock).size).toBe(0);
    expect(registerSeenUrls('../x', ['c'], clock).size).toBe(0);
  });
  it('survives corrupt storage and bounds its size', () => {
    localStorage.setItem('seomi_project_p1_site_focus_first_seen_v1', '[1]');
    expect(registerSeenUrls('p1', ['a']).size).toBe(0);
    localStorage.setItem('seomi_project_p1_site_focus_first_seen_v1', JSON.stringify({ a: 'x', b: 5 }));
    registerSeenUrls('p1', Array.from({ length: 5100 }, (_, i) => `u${i}`));
    expect(Object.keys(JSON.parse(localStorage.getItem('seomi_project_p1_site_focus_first_seen_v1') as string))).toHaveLength(5000);
  });
});
