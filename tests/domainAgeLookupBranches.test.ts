import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useDomainAgeLookup } from '@/components/SeoTools/workspace/useDomainAgeLookup';
import { domainAgeInputStorageKey } from '@/components/SeoTools/workspace/seoToolsTypes';
import { useProjectStore } from '@/stores/projectStore';

const fetchMock = vi.fn();
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const select = (id: string | null, rootUrl = 'https://root.test/') => useProjectStore.setState({ activeProjectId: id, projects: id ? [{ id, rootUrl }] : [] } as never);
const tt = (k: string, o?: Record<string, unknown>) => i18n.t(`seoTools.${k}`, o);

describe('useDomainAgeLookup', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    select('p1');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('seeds the domain from the project root and persists edits per project', () => {
    const { result } = renderHook(() => useDomainAgeLookup());
    expect(result.current.domain).toBe('https://root.test/');
    act(() => result.current.updateDomain('example.org'));
    expect(localStorage.getItem(domainAgeInputStorageKey('p1'))).toBe('example.org');
    expect(result.current.domain).toBe('example.org');
  });

  it('prefers a stored value and clears everything without a project', () => {
    localStorage.setItem(domainAgeInputStorageKey('p1'), 'stored.test');
    const { result } = renderHook(() => useDomainAgeLookup());
    expect(result.current.domain).toBe('stored.test');
    act(() => select(null));
    expect(result.current.domain).toBe('');
    act(() => result.current.updateDomain('free.test'));
    expect(result.current.domain).toBe('free.test');
    expect(localStorage.length).toBe(1);
  });

  it('reports an invalid domain without calling the network', async () => {
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('   '));
    await act(() => result.current.check());
    expect(result.current.error).toBe(tt('invalidDomain'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stores the RDAP record and registration date', async () => {
    const payload = { events: [{ eventAction: 'last changed', eventDate: 'x' }, { eventAction: 'Registration', eventDate: '2001-02-03T00:00:00Z' }] };
    fetchMock.mockReturnValue(ok(payload));
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    await act(() => result.current.check());
    expect(fetchMock).toHaveBeenCalledWith('https://rdap.org/domain/example.org', expect.objectContaining({ headers: { Accept: 'application/rdap+json, application/json' } }));
    expect(result.current.record).toEqual(payload);
    expect(result.current.registrationDate).toBe('2001-02-03T00:00:00Z');
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('flags a record without a registration event, with or without events', async () => {
    fetchMock.mockReturnValueOnce(ok({ events: [] })).mockReturnValueOnce(ok({}));
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    await act(() => result.current.check());
    expect(result.current.registrationDate).toBeNull();
    expect(result.current.record).toEqual({ events: [] });
    expect(result.current.error).toBe(tt('rdapUnavailable'));
    await act(() => result.current.check());
    expect(result.current.record).toEqual({});
    expect(result.current.error).toBe(tt('rdapUnavailable'));
  });

  it('reports HTTP failures and generic network failures differently', async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 404 })).mockRejectedValueOnce(new TypeError('offline')).mockRejectedValueOnce('weird');
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    await act(() => result.current.check());
    expect(result.current.error).toBe(tt('lookupFailed', { error: 'HTTP 404' }));
    await act(() => result.current.check());
    expect(result.current.error).toBe(tt('lookupFailed', { error: tt('rdapUnavailable') }));
    await act(() => result.current.check());
    expect(result.current.error).toBe(tt('lookupFailed', { error: tt('rdapUnavailable') }));
    expect(result.current.loading).toBe(false);
  });

  it('aborts the request after ten seconds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: RequestInit) => new Promise((_, reject) => { signal = init.signal as AbortSignal; signal.addEventListener('abort', () => reject(new Error('aborted'))); }));
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.check(); });
    expect(result.current.loading).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await pending; });
    expect(signal?.aborted).toBe(true);
    expect(result.current.error).toBe(tt('lookupFailed', { error: tt('rdapUnavailable') }));
    expect(result.current.loading).toBe(false);
  });

  it('ignores a stale response after the project changes and aborts the request', async () => {
    let resolve: (v: unknown) => void = () => undefined;
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_u: string, init: RequestInit) => { signal = init.signal as AbortSignal; return new Promise((r) => { resolve = r; }); });
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.check(); });
    act(() => select('p2', 'https://two.test/'));
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolve({ ok: true, status: 200, json: () => Promise.resolve({ events: [{ eventAction: 'registration', eventDate: 'old' }] }) }); await pending; });
    await waitFor(() => expect(result.current.domain).toBe('https://two.test/'));
    expect(result.current.record).toBeNull();
    expect(result.current.registrationDate).toBeNull();
  });

  it('suppresses a stale failure from a superseded request', async () => {
    const rejecters: Array<(e: unknown) => void> = [];
    fetchMock.mockImplementationOnce(() => new Promise((_, r) => { rejecters.push(r); })).mockReturnValueOnce(ok({ events: [{ eventAction: 'registration', eventDate: 'new' }] }));
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    let first: Promise<void> = Promise.resolve();
    act(() => { first = result.current.check(); });
    await act(() => result.current.check());
    await act(async () => { rejecters[0](new Error('HTTP 500')); await first; });
    expect(result.current.registrationDate).toBe('new');
    expect(result.current.error).toBeNull();
  });
});
