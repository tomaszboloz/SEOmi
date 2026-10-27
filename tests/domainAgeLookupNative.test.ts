import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useDomainAgeLookup } from '@/components/SeoTools/workspace/useDomainAgeLookup';
import { useProjectStore } from '@/stores/projectStore';
import { invokeTauriCommand } from '@/services/tauri';

vi.mock('@/services/tauri', () => ({ isTauriEnvironment: () => true, invokeTauriCommand: vi.fn() }));

describe('useDomainAgeLookup on desktop', () => {
  const fetchMock = vi.fn();
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    fetchMock.mockReset();
    vi.mocked(invokeTauriCommand).mockReset();
    vi.stubGlobal('fetch', fetchMock);
    useProjectStore.setState({ activeProjectId: 'p1', projects: [{ id: 'p1', rootUrl: 'https://root.test/' }] } as never);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('queries RDAP through the native command and never uses WebView fetch', async () => {
    const payload = { events: [{ eventAction: 'registration', eventDate: '2001-02-03T00:00:00Z' }] };
    vi.mocked(invokeTauriCommand).mockResolvedValue(payload);
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    await act(() => result.current.check());
    expect(invokeTauriCommand).toHaveBeenCalledWith('rdap_domain_lookup', { domain: 'example.org' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.registrationDate).toBe('2001-02-03T00:00:00Z');
  });

  it('reports a native failure and an aborted request as lookup failures', async () => {
    vi.mocked(invokeTauriCommand).mockRejectedValueOnce('HTTP 404');
    const { result } = renderHook(() => useDomainAgeLookup());
    act(() => result.current.updateDomain('example.org'));
    await act(() => result.current.check());
    expect(result.current.error).toBe(i18n.t('seoTools.lookupFailed', { error: i18n.t('seoTools.rdapUnavailable') }));

    vi.useFakeTimers();
    vi.mocked(invokeTauriCommand).mockReturnValue(new Promise(() => undefined));
    let pending!: Promise<void>;
    act(() => { pending = result.current.check(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); await pending; });
    expect(result.current.error).toBe(i18n.t('seoTools.lookupFailed', { error: i18n.t('seoTools.rdapUnavailable') }));
  });
});
