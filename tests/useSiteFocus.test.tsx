import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

import { useSiteFocus } from '@/hooks/useSiteFocus';
import { readFocusHistory, readManualTopic, registerSeenUrls } from '@/services/siteFocusMonitoring';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { DIABETES_TERMS, PHONE_TERMS, diabetesSite, makePage } from './siteFocusFixtures';

const HOST = 'diabetes.test';
const run = (id: string) => createCrawlRunFixture({ id, startUrl: `https://${HOST}/`, result: createCrawlResultFixture({ pages: diabetesSite(HOST) }) });

beforeEach(() => localStorage.clear());

describe('useSiteFocus', () => {
  it('returns an empty state without a completed run or valid project', () => {
    const { result } = renderHook(() => useSiteFocus(null, null));
    expect(result.current.report).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.recomputeBudget.remaining).toBe(0);
    let outcome: ReturnType<typeof result.current.recompute> | undefined;
    act(() => { outcome = result.current.recompute(); });
    expect(outcome?.ok).toBe(false);
    act(() => result.current.setManualTopic('diabetes'));
    expect(result.current.manualTopic).toBeUndefined();
    expect(result.current.incrementalUpdate([])).toEqual([]);
  });

  it('builds the report, saves one snapshot per run and exposes history and annotations', () => {
    const first = run('r1');
    const { result, rerender } = renderHook(({ r }) => useSiteFocus(r, 'p1'), { initialProps: { r: first } });
    expect(result.current.report?.score).toBeGreaterThan(0);
    expect(result.current.history.map((s) => s.runId)).toEqual(['r1']);
    rerender({ r: { ...first } });
    expect(readFocusHistory('p1')).toHaveLength(1);
    rerender({ r: run('r2') });
    expect(result.current.history.map((s) => s.runId)).toEqual(['r1', 'r2']);
    expect(result.current.annotations).toHaveProperty('r2');
  });

  it('applies and persists the manual topic, then resets on project change', () => {
    const { result, rerender } = renderHook(({ id }) => useSiteFocus(run('r1'), id), { initialProps: { id: 'p1' } });
    const before = result.current.report?.coreTopic.label;
    act(() => result.current.setManualTopic(['phone', 'battery']));
    expect(readManualTopic('p1')).toEqual(['phone', 'battery']);
    expect(result.current.manualTopic).toEqual(['phone', 'battery']);
    expect(result.current.report?.coreTopic.label).not.toBe(before);
    act(() => result.current.setManualTopic(null));
    expect(result.current.manualTopic).toBeUndefined();
    rerender({ id: 'p2' });
    expect(result.current.history.map((s) => s.runId)).toEqual(['r1']);
  });

  it('limits manual recomputation to three per day with an injected clock', () => {
    let now = new Date(2026, 9, 15, 9).getTime();
    const { result } = renderHook(() => useSiteFocus(run('r1'), 'p1', { clock: () => now }));
    const outcomes: boolean[] = [];
    for (let i = 0; i < 4; i += 1) act(() => { now += 1000; outcomes.push(result.current.recompute().ok); });
    expect(outcomes).toEqual([true, true, true, false]);
    expect(result.current.recomputeBudget).toMatchObject({ used: 3, remaining: 0 });
    expect(result.current.history).toHaveLength(4);
    now = new Date(2026, 9, 16, 9).getTime();
    act(() => { expect(result.current.recompute().ok).toBe(true); });
  });

  it('incrementally scores new pages and refunds nothing for incomplete runs', () => {
    const base = run('r1');
    const { result } = renderHook(() => useSiteFocus(base, 'p1', { clock: () => 9_000_000 }));
    registerSeenUrls('p1', base.result.pages.map((p) => p.url), () => 1);
    const phone = makePage(HOST, { path: '/phones/new', title: 'Phone', terms: PHONE_TERMS.map((t): [string, number] => [t, 6]) });
    const article = makePage(HOST, { path: '/articles/n', title: 'Insulin', terms: DIABETES_TERMS.slice(0, 10).map((t): [string, number] => [t, 4]) });
    let scored: unknown[] = [];
    act(() => { scored = result.current.incrementalUpdate([phone, article]); });
    expect(scored).toHaveLength(2);
    expect(result.current.report?.pages.length).toBe(diabetesSite(HOST).length + 2);

    const cancelled = createCrawlRunFixture({ result: createCrawlResultFixture({ cancelled: true, pages: diabetesSite(HOST) }) });
    const incomplete = renderHook(() => useSiteFocus(cancelled, 'p9'));
    expect(incomplete.result.current.report).toBeNull();
    act(() => { expect(incomplete.result.current.recompute().ok).toBe(false); });
  });
});
