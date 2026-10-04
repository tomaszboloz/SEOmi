import { afterEach, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { filterHook, filterVerdict } from './fixtures/crawlFilterHook';
import { deferred } from './fixtures/gscSliceDirect';
import type { CrawlFilterValidationResult } from '@/types';

afterEach(cleanup);

it.each(['success', 'failure'] as const)('ignores old %s and returns null after switching projects', async (outcome) => {
  const fixture = filterHook();
  const old = deferred<CrawlFilterValidationResult>();
  fixture.services.invoke.mockReturnValueOnce(old.promise);
  let pending!: Promise<CrawlFilterValidationResult | null>;
  act(() => { pending = fixture.result.current.validateFilters(); });
  fixture.rerender({ project: 'two', url: 'https://other.test' });
  expect(fixture.result.current.isCheckingFilters).toBe(false);
  let result: CrawlFilterValidationResult | null = filterVerdict();
  await act(async () => {
    if (outcome === 'failure') old.reject(new Error('Stale failure'));
    else old.resolve(filterVerdict());
    result = await pending;
  });
  expect(result).toBeNull();
  expect(fixture.result.current).toMatchObject({ filterValidation: null, filterValidationError: null, isCheckingFilters: false });
});

it.each(['success', 'failure'] as const)('does not replace a newer verdict with stale %s or finish its loading state', async (outcome) => {
  const fixture = filterHook();
  const old = deferred<CrawlFilterValidationResult>();
  const current = deferred<CrawlFilterValidationResult>();
  fixture.services.invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  let pending!: Promise<CrawlFilterValidationResult | null>;
  let latest!: Promise<CrawlFilterValidationResult | null>;
  act(() => { pending = fixture.result.current.validateFilters(); });
  act(() => { latest = fixture.result.current.validateFilters(); });
  await act(async () => {
    if (outcome === 'failure') old.reject(new Error('Stale failure'));
    else old.resolve(filterVerdict());
    expect(await pending).toBeNull();
  });
  expect(fixture.result.current).toMatchObject({ filterValidation: null, filterValidationError: null, isCheckingFilters: true });
  await act(async () => { current.resolve(filterVerdict(false)); expect(await latest).toEqual(filterVerdict(false)); });
  expect(fixture.result.current).toMatchObject({ filterValidation: filterVerdict(false), isCheckingFilters: false });
});

it('invalidates pending validation when patterns change and does not accept old permission to start', async () => {
  const fixture = filterHook();
  const old = deferred<CrawlFilterValidationResult>();
  fixture.services.invoke.mockReturnValueOnce(old.promise);
  let pending!: Promise<CrawlFilterValidationResult | null>;
  act(() => { pending = fixture.result.current.validateFilters(); });
  act(() => fixture.result.current.setFilterPatterns('includePatterns', '  /new  \n \n /other '));
  expect(fixture.setCrawlConfig).toHaveBeenCalledWith({ includePatterns: ['/new', '/other'] });
  await act(async () => { old.resolve(filterVerdict()); expect(await pending).toBeNull(); });
  expect(fixture.result.current).toMatchObject({ filterValidation: null, filterValidationError: null, isCheckingFilters: false });
});
