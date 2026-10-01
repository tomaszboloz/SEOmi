import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStorageAvailable, readJsonStorage, readStorage, readStorageEntries, removeStorage, writeJsonStorage, writeStorage, writeStorageResult, readEphemeralStorage, writeEphemeralStorage, removeEphemeralStorage } from '@/services/storage';

describe('locked WebView storage adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the caller alive when localStorage operations throw', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage blocked'); },
      setItem: () => { throw new Error('storage blocked'); },
      removeItem: () => { throw new Error('storage blocked'); },
    });

    expect(readStorage('key')).toBeNull();
    expect(writeStorage('key', 'value')).toBe(false);
    expect(removeStorage('key')).toBe(false);
    expect(isStorageAvailable()).toBe(false);
  });

  it('uses normal storage when the WebView permits it', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    expect(writeStorage('key', 'value')).toBe(true);
    expect(readStorage('key')).toBe('value');
    expect(removeStorage('key')).toBe(true);
    expect(readStorage('key')).toBeNull();
    expect(isStorageAvailable()).toBe(true);
  });

  it('keeps JSON preferences and bounded project backup enumeration safe', () => {
    const values = new Map<string, string>([
      ['seomi_project_demo_sidebar_v1', JSON.stringify({ collapsed: true })],
      ['seomi_project_demo_empty', ''],
      ['unrelated', 'ignore'],
    ]);
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
      key: (index: number) => [...values.keys()][index] || null,
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });

    expect(writeJsonStorage('preference', { enabled: true })).toBe(true);
    expect(readJsonStorage('preference', { enabled: false })).toEqual({ enabled: true });
    expect(readJsonStorage('malformed', { fallback: true })).toEqual({ fallback: true });
    expect(readStorageEntries('seomi_project_demo_')).toEqual({
      sidebar_v1: JSON.stringify({ collapsed: true }),
      empty: '',
    });
  });
});

it('enumerates storage with linear bookkeeping work and respects the entry ceiling', () => {
  const originalKeys = Object.keys;
  let enumerated = 0;
  const spy = vi.spyOn(Object, 'keys').mockImplementation((value) => {
    const keys = originalKeys(value); enumerated += keys.length; return keys;
  });
  vi.stubGlobal('localStorage', { length: 501, key: (index: number) => `project_${index}`, getItem: () => 'value' });
  try {
    const entries = readStorageEntries('project_', 500);
    expect(originalKeys(entries)).toHaveLength(500);
    expect(enumerated).toBeLessThanOrEqual(1000);
  } finally { spy.mockRestore(); vi.unstubAllGlobals(); }
});

it('handles invalid ceilings, duplicate enumeration keys and prototype-like suffixes safely', () => {
  vi.stubGlobal('localStorage', { length: 3, key: (index: number) => ['project___proto__', 'project_a', 'project_a'][index], getItem: () => 'value' });
  try {
    for (const limit of [0, -1, Infinity, NaN]) expect(readStorageEntries('project_', limit)).toEqual({});
    const result = readStorageEntries('project_', 5);
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true);
    expect(result.__proto__).toBe('value');
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.keys(result)).toHaveLength(2);
  } finally { vi.unstubAllGlobals(); }
});

it('returns structured durable write results without hiding the actual storage failure',()=>{
  localStorage.clear();
  expect(writeStorageResult('fixture','value')).toEqual({ok:true});
  expect(localStorage.getItem('fixture')).toBe('value');
  const failure=new Error('quota exceeded');
  vi.stubGlobal('localStorage',{setItem:()=>{throw failure;}});
  try {expect(writeStorageResult('fixture','next')).toEqual({ok:false,error:failure});}
  finally {vi.unstubAllGlobals();}
});

it('keeps ephemeral secrets out of durable storage and handles blocked or missing session storage',()=>{
  localStorage.clear();sessionStorage.clear();
  expect(readEphemeralStorage('secret')).toBeNull();
  expect(writeEphemeralStorage('secret','fixture')).toBe(true);
  expect(readEphemeralStorage('secret')).toBe('fixture');
  expect(localStorage.getItem('secret')).toBeNull();
  expect(removeEphemeralStorage('secret')).toBe(true);
  expect(readEphemeralStorage('secret')).toBeNull();
  for(const storage of [undefined,{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');},removeItem:()=>{throw new Error('blocked');}}]) {
    vi.stubGlobal('sessionStorage',storage);
    expect(readEphemeralStorage('secret')).toBeNull();
    expect(writeEphemeralStorage('secret','fixture')).toBe(false);
    expect(removeEphemeralStorage('secret')).toBe(false);
  }
  vi.unstubAllGlobals();
});
