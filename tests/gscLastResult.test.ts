import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGscLastResult, gscLastResultKey, loadGscLastResult, rememberedGscData, saveGscLastResult,
} from '@/stores/tools/gscLastResult';
import { gscSliceFixture } from './fixtures/gscSliceDirect';
import { gscData } from './fixtures/gscTracker';

const PROPERTY = 'sc-domain:example.com';
const AT = '2026-10-28T08:00:00.000Z';

beforeEach(() => localStorage.clear());

describe('remembered GSC report', () => {
  it('returns the stored report only for the same property and filters', () => {
    expect(saveGscLastResult('p1', { data: gscData(), fetchedAt: AT, filters: { device: 'MOBILE' } })).toBe(true);
    expect(loadGscLastResult('p1', PROPERTY, { device: 'MOBILE' })?.fetchedAt).toBe(AT);
    expect(loadGscLastResult('p1', PROPERTY, {})).toBeNull();
    expect(loadGscLastResult('p1', 'https://other.test/', { device: 'MOBILE' })).toBeNull();
    expect(loadGscLastResult('p2', PROPERTY, { device: 'MOBILE' })).toBeNull();
    expect(loadGscLastResult('p1', '', {})).toBeNull();
    expect(rememberedGscData('p1', PROPERTY, {})).toEqual({ gscData: null, gscDataFetchedAt: null });
    clearGscLastResult('p1');
    expect(localStorage.getItem(gscLastResultKey('p1'))).toBeNull();
    expect(saveGscLastResult('', { data: gscData(), fetchedAt: AT, filters: {} })).toBe(false);
  });

  it('ignores damaged or partial storage', () => {
    const put = (value: unknown) => localStorage.setItem(gscLastResultKey('p1'), JSON.stringify(value));
    put('text');
    expect(loadGscLastResult('p1', PROPERTY, {})).toBeNull();
    put({ data: { ...gscData(), queries: 'x' }, fetchedAt: AT, filters: {} });
    expect(loadGscLastResult('p1', PROPERTY, {})).toBeNull();
    put({ data: gscData(), fetchedAt: 'not a date', filters: {} });
    expect(loadGscLastResult('p1', PROPERTY, {})).toBeNull();
    put({ data: gscData() , fetchedAt: AT });
    expect(loadGscLastResult('p1', PROPERTY, {})).toEqual({ data: gscData(), fetchedAt: AT, filters: {} });
  });
});

describe('GSC slice remembers the last report', () => {
  it('saves after refresh, restores on property/filter switch back and clears on disconnect', async () => {
    const { store, invoke } = gscSliceFixture();
    invoke.mockResolvedValueOnce(gscData());
    await store.getState().refreshGscData(undefined, {});
    expect(loadGscLastResult('gsc-direct', PROPERTY, {})?.data.total_clicks).toBe(100);

    store.getState().setGscProperty('https://other.test/');
    expect(store.getState().gscData).toBeNull();
    store.getState().setGscProperty(PROPERTY);
    expect(store.getState().gscData?.total_clicks).toBe(100);
    expect(store.getState().gscDataFetchedAt).toEqual(expect.any(String));

    store.getState().setGscFilters({ device: 'DESKTOP' });
    expect(store.getState().gscData).toBeNull();
    store.getState().setGscFilters({});
    expect(store.getState().gscData?.total_clicks).toBe(100);

    invoke.mockResolvedValueOnce('disconnected');
    await store.getState().disconnectGsc();
    expect(store.getState().gscData).toBeNull();
    expect(loadGscLastResult('gsc-direct', PROPERTY, {})).toBeNull();
  });
});
