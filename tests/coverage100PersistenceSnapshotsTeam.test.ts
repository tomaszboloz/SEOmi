import { describe, expect, it, vi } from 'vitest';
import { CrawlEventLog, deepFreeze, freezeCopy, openSimulationSession } from '@/services/snapshots';
import { appendAudit, verifyChain, type AuditEntry } from '@/services/team/auditLog';
import { excludeQuarantinedPages, runRecommendationBus } from '@/services/recommendationBus';
import type { CrawlEvent } from '@/services/snapshots';

type State = { urls: string[] };
const reduce = (state: State, event: CrawlEvent): State => ({ urls: [...state.urls, (event.payload as { url: string }).url] });

describe('snapshot and event edge contracts', () => {
  it('projects an earlier revision with a fresh initial state', () => {
    const log = new CrawlEventLog();
    log.append('page', { url: 'a' });
    log.append('page', { url: 'b' });
    expect(log.project(reduce, () => ({ urls: ['seed'] }), 1)).toEqual({ urls: ['seed', 'a'] });
    expect(log.project(reduce, () => ({ urls: [] }), 99)).toEqual({ urls: ['a', 'b'] });
  });

  it('keeps already frozen values unchanged and detaches nested arrays', () => {
    const frozen = Object.freeze({ nested: Object.freeze({ value: 1 }) });
    expect(deepFreeze(frozen)).toBe(frozen);
    const source = { rows: [{ id: 'a' }] };
    const copied = freezeCopy(source);
    expect(copied).not.toBe(source);
    expect(copied.rows).not.toBe(source.rows);
    expect(Object.isFrozen(copied.rows[0])).toBe(true);
  });

  it('refreshes a session from the latest event revision without changing its snapshot', () => {
    const log = new CrawlEventLog();
    log.append('page', { url: 'a' });
    const old = openSimulationSession(log, reduce, () => ({ urls: [] }));
    log.append('page', { url: 'b' });
    const fresh = old.refresh();
    expect(old.snapshot.urls).toEqual(['a']);
    expect(old.isStale()).toBe(true);
    expect(fresh.snapshot.urls).toEqual(['a', 'b']);
  });
});

describe('audit and recommendation recovery edges', () => {
  const input = { actor: 'ann', role: 'admin' as const, action: 'crawl', projectId: 'p', result: 'success' as const };
  it('hashes metadata by key order so equivalent records verify identically', async () => {
    const at = new Date('2026-01-01T00:00:00Z');
    const one = await appendAudit([], { ...input, metadata: { z: 1, a: true } }, 'id', at);
    const two = await appendAudit([], { ...input, metadata: { a: true, z: 1 } }, 'id', at);
    expect(one[0].hash).toBe(two[0].hash);
    expect(await verifyChain(one)).toEqual({ ok: true });
    const malformed = [{ ...one[0], seq: 2 }] as AuditEntry[];
    expect(await verifyChain(malformed)).toEqual({ ok: false, brokenAt: 0, reason: 'seq' });
  });

  it('drops pages whose requested or final URL is quarantined', () => {
    const { quarantine } = runRecommendationBus({ removeUrls: ['https://site.test/old'] });
    const pages = [
      { url: 'https://site.test/old', final_url: 'https://site.test/current' },
      { url: 'https://site.test/current', final_url: 'https://site.test/current' },
      { url: 'https://site.test/keep' },
    ];
    expect(excludeQuarantinedPages(pages, quarantine)).toEqual([pages[1], pages[2]]);
  });

  it('does not notify a removed subscription twice', () => {
    const log = new CrawlEventLog();
    const sink = vi.fn();
    const off = log.subscribe(sink);
    log.subscribe(sink);
    off();
    log.append('page', { url: 'a' });
    expect(sink).not.toHaveBeenCalled();
  });
});
