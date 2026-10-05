import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asArray, asRecord, asRequestError, booleanish, displayLocale, intent, localizedDomainOperation,
  normalizeDataForSeoDomain, nullableIntent, nullableNumber, number, providerQuotaMessage,
  retryDelayMs, statusFromMessage, text, wait,
} from '@/services/dataforseo/dataforseoHelpers';
import { DataForSeoRequestError } from '@/services/dataforseo/dataforseoTypes';
import { ResearchDomainError } from '../mcp-server/src/contracts/researchDomain.js';
import i18n from '@/i18n';

describe('dataforseo value coercion', () => {
  it('asRecord and asArray accept only objects and arrays', () => {
    const obj = { a: 1 };
    expect(asRecord(obj)).toBe(obj);
    expect(asRecord(null)).toEqual({});
    expect(asRecord('str')).toEqual({});
    expect(asArray([1])).toEqual([1]);
    expect(asArray({ length: 1 })).toEqual([]);
  });

  it('number coerces strings and falls back to zero', () => {
    expect(number(4)).toBe(4);
    expect(number('7.5')).toBe(7.5);
    expect(number('abc')).toBe(0);
    expect(number(undefined)).toBe(0);
    expect(number(Number.NaN)).toBeNaN();
  });

  it('nullableNumber treats blank values and non-finite numbers as null', () => {
    expect(nullableNumber(null)).toBeNull();
    expect(nullableNumber(undefined)).toBeNull();
    expect(nullableNumber('')).toBeNull();
    expect(nullableNumber('x')).toBeNull();
    expect(nullableNumber(Infinity)).toBeNull();
    expect(nullableNumber('3')).toBe(3);
    expect(nullableNumber(0)).toBe(0);
  });

  it('text returns strings only', () => {
    expect(text('a')).toBe('a');
    expect(text(5)).toBe('');
    expect(text(null)).toBe('');
  });

  it('booleanish understands booleans, numbers and truthy strings', () => {
    expect(booleanish(true)).toBe(true);
    expect(booleanish(false)).toBe(false);
    expect(booleanish(2)).toBe(true);
    expect(booleanish(0)).toBe(false);
    for (const v of ['1', ' TRUE ', 'Yes', 'dofollow']) expect(booleanish(v)).toBe(true);
    for (const v of ['0', 'no', 'nofollow', '']) expect(booleanish(v)).toBe(false);
    expect(booleanish({})).toBe(false);
    expect(booleanish(null)).toBe(false);
  });

  it('intent normalizes provider labels and nullableIntent skips blanks', () => {
    expect(intent('Transactional')).toBe('Transactional');
    expect(intent('COMMERCIAL investigation')).toBe('Commercial');
    expect(intent('informational')).toBe('Informational');
    expect(intent('whatever')).toBe('Navigational');
    expect(intent(5)).toBe('Navigational');
    expect(nullableIntent('commercial')).toBe('Commercial');
    expect(nullableIntent('   ')).toBeNull();
    expect(nullableIntent(7)).toBeNull();
  });
});

describe('dataforseo error handling', () => {
  it('extracts HTTP status codes from messages', () => {
    expect(statusFromMessage('failed with HTTP 429 too many')).toBe(429);
    expect(statusFromMessage('http 503')).toBe(503);
    expect(statusFromMessage('no status here')).toBeNull();
  });

  it('detects provider quota wording', () => {
    for (const m of ['Quota exceeded', 'rate limit hit', 'Insufficient funds', 'low balance', 'billing issue', 'account limit']) {
      expect(providerQuotaMessage(m)).toBe(true);
    }
    expect(providerQuotaMessage('temporary glitch')).toBe(false);
  });

  it('keeps existing request errors untouched', () => {
    const original = new DataForSeoRequestError('x', 500);
    expect(asRequestError(original)).toBe(original);
  });

  it('marks plain 429 as retryable and quota 429 as non-retryable', () => {
    const throttle = asRequestError(new Error('HTTP 429 slow down'));
    expect([throttle.status, throttle.retryable, throttle.quotaExceeded]).toEqual([429, true, false]);
    const quota = asRequestError(new Error('HTTP 429 account limit reached'));
    expect([quota.status, quota.retryable, quota.quotaExceeded]).toEqual([429, false, true]);
    const other = asRequestError('HTTP 500 boom');
    expect([other.message, other.status, other.retryable]).toEqual(['HTTP 500 boom', 500, false]);
    expect(asRequestError('plain').status).toBeNull();
  });

  it('computes bounded retry delays', () => {
    expect(retryDelayMs(new DataForSeoRequestError('x', 429, true, false, 3), 0)).toBe(3000);
    expect(retryDelayMs(new DataForSeoRequestError('x', 429, true, false, 60), 0)).toBe(10_000);
    expect(retryDelayMs(new DataForSeoRequestError('x', 429, true, false, -5), 0)).toBe(0);
    const plain = new DataForSeoRequestError('x');
    expect([0, 1, 2, 3, 4].map((a) => retryDelayMs(plain, a))).toEqual([250, 500, 1000, 2000, 2000]);
  });
});

describe('dataforseo async and locale helpers', () => {
  beforeEach(() => i18n.changeLanguage('en'));
  afterEach(() => vi.useRealTimers());

  it('wait resolves only after the delay', async () => {
    vi.useFakeTimers();
    let done = false;
    void wait(500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it('translates domain contract errors and rethrows others', () => {
    const run = () => localizedDomainOperation(() => { throw new ResearchDomainError('domainInvalid'); });
    expect(run).toThrow(i18n.t('runtimeErrors.dataforseo.domainInvalid'));
    try { run(); } catch (e) { expect((e as Error).cause).toBeInstanceOf(ResearchDomainError); }
    const boom = new TypeError('other');
    expect(() => localizedDomainOperation(() => { throw boom; })).toThrow(boom);
    expect(localizedDomainOperation(() => 42)).toBe(42);
  });

  it('normalizes domains and localizes failures', () => {
    expect(normalizeDataForSeoDomain(' https://WWW.Example.com/path ')).toBe('example.com');
    expect(() => normalizeDataForSeoDomain('')).toThrow(i18n.t('runtimeErrors.dataforseo.domainRequired'));
    expect(() => normalizeDataForSeoDomain('localhost')).toThrow(i18n.t('runtimeErrors.dataforseo.domainInvalid'));
  });

  it('derives the display locale from the active language', async () => {
    await i18n.changeLanguage('pl');
    expect(displayLocale()).toBe('pl');
    const spy = vi.spyOn(i18n, 'language', 'get').mockReturnValue('' as never);
    expect(displayLocale()).toBe('en');
    spy.mockReturnValue('pt_BR' as never);
    expect(displayLocale()).toBe('pt-BR');
    spy.mockRestore();
  });
});
