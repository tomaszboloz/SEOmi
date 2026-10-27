import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { CrawlEventLog, deepFreeze, freezeCopy, openSimulationSession, useSnapshotStale } from '@/services/snapshots';
import { StaleSnapshotBanner } from '@/services/snapshots/StaleBanner';
import type { CrawlEvent } from '@/services/snapshots';

type Graph = { pages: string[] };
const reducer = (state: Graph, event: CrawlEvent): Graph => ({ pages: [...state.pages, (event.payload as { url: string }).url] });
const initial = (): Graph => ({ pages: [] });

describe('snapshot sessions', () => {
  it('freezes deeply and detaches from the source', () => {
    const source = { a: { b: [1] } };
    const copy = freezeCopy(source);
    expect(Object.isFrozen(copy.a.b)).toBe(true);
    source.a.b.push(2);
    expect(copy.a.b).toEqual([1]);
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze(null)).toBeNull();
    expect(() => { (copy.a as { b: number[] }).b.push(3); }).toThrow();
  });

  it('keeps an open simulation unchanged while a crawl keeps appending', async () => {
    const log = new CrawlEventLog();
    log.append('page', { url: 'a' });
    const session = openSimulationSession(log, reducer, initial);
    expect(session.isStale()).toBe(false);
    await Promise.all(Array.from({ length: 200 }, async (_, i) => { log.append('page', { url: `p${i}` }); }));
    expect(session.snapshot.pages).toEqual(['a']);
    expect(session.isStale()).toBe(true);
    expect(() => { (session.snapshot.pages as string[]).push('x'); }).toThrow();
    const fresh = session.refresh();
    expect(fresh.snapshot.pages).toHaveLength(201);
    expect(fresh.isStale()).toBe(false);
    expect(session.snapshot.pages).toEqual(['a']);
  });

  it('shares no mutable reference between payload and log', () => {
    const log = new CrawlEventLog();
    const payload = { url: 'a' };
    const event = log.append('page', payload, () => new Date('2026-01-01T00:00:00Z'));
    payload.url = 'mutated';
    expect(event.payload).toEqual({ url: 'a' });
    expect(event.at).toBe('2026-01-01T00:00:00.000Z');
    expect(log.project(reducer, initial, 0).pages).toEqual([]);
  });

  it('unsubscribes sinks', () => {
    const log = new CrawlEventLog();
    const sink = vi.fn();
    const off = log.subscribe(sink);
    log.append('x', { url: '1' });
    off();
    log.append('x', { url: '2' });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('hook flips stale on append and banner refreshes', () => {
    const log = new CrawlEventLog();
    const { result } = renderHook(() => useSnapshotStale(log, 0));
    expect(result.current).toBe(false);
    act(() => { log.append('x', { url: '1' }); });
    expect(result.current).toBe(true);
    const onRefresh = vi.fn();
    const { rerender } = render(<StaleSnapshotBanner stale={false} onRefresh={onRefresh} />);
    expect(screen.queryByTestId('stale-snapshot-banner')).toBeNull();
    rerender(<StaleSnapshotBanner stale onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onRefresh).toHaveBeenCalled();
  });
});
