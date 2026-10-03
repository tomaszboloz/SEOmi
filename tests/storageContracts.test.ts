import { z } from 'zod';
import { beforeEach, expect, it } from 'vitest';
import { parseJsonRecord, parseRecordEntries, readJsonRecord } from '@/services/storageContracts';
import { readJsonStorage } from '@/services/storage';

beforeEach(() => localStorage.clear());

it('returns raw storage values as unknown and guards records against null, scalars and arrays', () => {
  for (const value of [null, 5, 'text', [], [1]]) expect(parseJsonRecord(value)).toEqual({});
  localStorage.setItem('record', 'null');
  expect(readJsonRecord('record')).toEqual({});
  localStorage.setItem('record', '[1]');
  expect(readJsonStorage('record', {})).toEqual([1]);
  expect(readJsonRecord('record')).toEqual({});
  localStorage.setItem('record', '{');
  expect(readJsonRecord('record')).toEqual({});
  localStorage.setItem('record', '{"value":0}');
  expect(readJsonRecord('record')).toEqual({ value: 0 });
});

it('retains valid entries independently, preserves zero and bounds results', () => {
  expect(parseRecordEntries({ a: 1, bad: '1', zero: 0 }, z.number().finite())).toEqual({ a: 1, zero: 0 });
  expect(parseRecordEntries({ a: 1, b: 2, c: 3 }, z.number(), 2)).toEqual({ b: 2, c: 3 });
  expect(parseRecordEntries({ false: false, invalid: 'false' }, z.boolean())).toEqual({ false: false });
  expect(parseRecordEntries(null, z.string())).toEqual({});
});

it('handles special record keys as own data properties without modifying prototypes', () => {
  const value: unknown = JSON.parse('{"__proto__":"fixture","constructor":"data"}');
  const result = parseRecordEntries(value, z.string());
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(Object.hasOwn(result, '__proto__')).toBe(true);
  expect(result.__proto__).toBe('fixture');
  expect(result.constructor).toBe('data');
});
