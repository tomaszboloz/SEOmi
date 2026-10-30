import { afterEach, describe, expect, it, vi } from 'vitest';
import { quarantineKey, readVersioned, writeVersioned, type VersionedSpec } from '@/services/analysisContracts';

interface V2 { name: string; score: number | null }
const isV2 = (data: unknown): data is V2 => !!data && typeof data === 'object' && 'score' in data && typeof (data as V2).name === 'string';
const spec: VersionedSpec<V2> = {
  key: 'seomi:test:versioned',
  version: 2,
  migrations: {
    0: (data) => ({ name: String((data as { title: string }).title) }),
    1: (data) => ({ ...(data as object), score: null }),
  },
  validate: isV2,
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('versioned artifact store (#85 GEM-85-08, T03)', () => {
  it('writes and reads the current version', () => {
    expect(writeVersioned(spec, { name: 'a', score: 0 })).toEqual({ ok: true });
    expect(readVersioned(spec)).toEqual({ status: 'ok', data: { name: 'a', score: 0 }, migratedFrom: null });
    expect(readVersioned({ ...spec, key: 'none' })).toEqual({ status: 'missing' });
  });

  it('migrates an unversioned legacy record step by step and persists it; unknown stays null', () => {
    localStorage.setItem(spec.key, JSON.stringify({ title: 'old' }));
    expect(readVersioned(spec)).toEqual({ status: 'ok', data: { name: 'old', score: null }, migratedFrom: 0 });
    expect(JSON.parse(localStorage.getItem(spec.key) as string)).toEqual({ schemaVersion: 2, data: { name: 'old', score: null } });
  });

  it('leaves the stored record untouched when a migration fails (rollback)', () => {
    const raw = JSON.stringify({ schemaVersion: 1, data: { name: 'x' } });
    localStorage.setItem(spec.key, raw);
    const broken = { ...spec, migrations: { 1: () => { throw new Error('bad step'); } } };
    expect(readVersioned(broken)).toEqual({ status: 'migration-failed', fromVersion: 1, step: 1, error: 'bad step' });
    expect(readVersioned({ ...spec, migrations: {} })).toMatchObject({ status: 'migration-failed', error: 'missing-migration' });
    expect(readVersioned({ ...spec, migrations: { 1: () => ({ nope: true }) } })).toMatchObject({ error: 'invalid-after-migration' });
    expect(localStorage.getItem(spec.key)).toBe(raw);
  });

  it('quarantines corrupt JSON and refuses records from a newer app version', () => {
    localStorage.setItem(spec.key, '{broken');
    expect(readVersioned(spec)).toEqual({ status: 'corrupt', quarantineKey: quarantineKey(spec.key) });
    expect(localStorage.getItem(quarantineKey(spec.key))).toBe('{broken');
    localStorage.setItem(spec.key, JSON.stringify({ schemaVersion: 9, data: {} }));
    expect(readVersioned(spec)).toEqual({ status: 'newer-version', version: 9 });
    localStorage.setItem(spec.key, JSON.stringify({ schemaVersion: 2, data: { name: 1 } }));
    expect(readVersioned(spec)).toEqual({ status: 'invalid' });
  });

  it('reports quota errors and keeps the previous value', () => {
    writeVersioned(spec, { name: 'keep', score: 1 });
    const before = localStorage.getItem(spec.key);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (value.includes('huge')) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
      original.call(this, key, value);
    });
    expect(writeVersioned(spec, { name: 'huge', score: 2 })).toEqual({ ok: false, reason: 'quota', rolledBack: true });
    expect(localStorage.getItem(spec.key)).toBe(before);
  });

  it('rolls back when read-back verification fails and rejects unserializable data', () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      original.call(this, key, value.replace('torn', 'tor'));
    });
    expect(writeVersioned(spec, { name: 'torn', score: 1 })).toEqual({ ok: false, reason: 'verify-failed', rolledBack: true });
    expect(localStorage.getItem(spec.key)).toBeNull();
    vi.restoreAllMocks();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(writeVersioned(spec, { name: 'a', score: 1 })).toMatchObject({ ok: false, reason: 'unavailable' });
    const cyclic: Record<string, unknown> = { name: 'c', score: 1 };
    cyclic.self = cyclic;
    expect(writeVersioned(spec, cyclic as unknown as V2)).toEqual({ ok: false, reason: 'serialize', rolledBack: false });
  });
});
