import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addIntervention, experimentsKey, interventionSchema, listInterventions, removeIntervention } from '@/services/experiments/registry';
import { experimentNow, intervention } from './fixtures/experiments';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('project-scoped intervention registry', () => {
  it('adds, lists and removes only within the selected project', () => {
    const first = addIntervention('p1', intervention, experimentNow)!;
    const second = addIntervention('p2', { ...intervention, url: 'site' }, experimentNow)!;
    expect(first.id.length).toBeGreaterThan(10);
    expect(first.id).not.toBe(second.id);
    expect(first.createdAt).toBe(experimentNow.toISOString());
    expect(listInterventions('p1')).toEqual([first]);
    expect(listInterventions('p2')).toEqual([second]);
    expect(removeIntervention('p1', first.id)).toBe(true);
    expect(listInterventions('p1')).toEqual([]);
    expect(listInterventions('p2')).toEqual([second]);
    expect(removeIntervention('p1', 'missing')).toBe(true);
  });

  it.each(['', '[]', 'null', '1', '"text"', '{broken'])('ignores malformed storage: %s', raw => {
    localStorage.setItem(experimentsKey('p1'), raw);
    expect(listInterventions('p1')).toEqual([]);
  });

  it('drops corrupt, foreign-project and mismatched-id entries independently', () => {
    localStorage.setItem(experimentsKey('p1'), JSON.stringify({
      [intervention.id]: intervention, bad: { ...intervention, id: 'bad', date: '2026-02-30' },
      foreign: { ...intervention, id: 'foreign', projectId: 'p2' }, mismatch: intervention, missing: {},
    }));
    expect(listInterventions('p1')).toEqual([intervention]);
  });

  it('sorts and bounds reads and writes to the latest 200 entries', () => {
    const entries = Array.from({ length: 205 }, (_, index) => ({
      ...intervention, id: `entry-${index}`, createdAt: new Date(index * 1000).toISOString(),
    }));
    localStorage.setItem(experimentsKey('p1'), JSON.stringify(Object.fromEntries(entries.map(entry => [entry.id, entry]))));
    const bounded = listInterventions('p1');
    expect(bounded).toHaveLength(200);
    expect(bounded[0].id).toBe('entry-204');
    const added = addIntervention('p1', intervention, experimentNow)!;
    expect(listInterventions('p1')).toHaveLength(200);
    expect(listInterventions('p1')[0]).toEqual(added);
    expect(listInterventions('p1').some(entry => entry.id === 'entry-5')).toBe(false);
  });

  it.each([
    { date: '2026-02-30' }, { date: '2026-9-01' }, { note: 'a'.repeat(301) }, { kind: 'invalid' },
    { url: 'ftp://example.com/' }, { url: 'https://user:password@example.com/' }, { url: '' }, { url: '/relative' },
  ])('rejects invalid input %j', extra => {
    expect(interventionSchema.safeParse({ ...intervention, ...extra }).success).toBe(false);
    expect(addIntervention('p1', { ...intervention, ...extra } as typeof intervention)).toBeNull();
    expect(listInterventions('p1')).toEqual([]);
  });

  it('allows planned dates, empty notes and the 300-character boundary', () => {
    expect(addIntervention('p1', { ...intervention, date: '2099-01-01', note: '' })).not.toBeNull();
    expect(addIntervention('p1', { ...intervention, note: 'a'.repeat(300) })).not.toBeNull();
  });

  it('rejects empty or padded project identities without writing', () => {
    expect(addIntervention('', intervention)).toBeNull();
    expect(addIntervention(' p1 ', intervention)).toBeNull();
    expect(listInterventions(' ')).toEqual([]);
    expect(removeIntervention('', intervention.id)).toBe(false);
    expect(localStorage.length).toBe(0);
  });

  it('reports blocked reads and failed writes honestly', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(listInterventions('p1')).toEqual([]);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(addIntervention('p1', intervention)).toBeNull();
    expect(removeIntervention('p1', intervention.id)).toBe(false);
  });
});
