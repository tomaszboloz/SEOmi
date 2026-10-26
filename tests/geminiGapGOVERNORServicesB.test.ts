import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import i18n from '@/i18n';
import { buildMetaAndIndexabilityChecks } from '@/services/auditChecks/httpAndMetaChecks';
import { DataForSEOCore } from '@/services/dataforseo/dataforseoCore';
import * as tauri from '@/services/tauri';
import type { PageAuditData } from '@/types';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('geminiGapGOVERNORServicesB: httpAndMetaChecks and dataforseoCore', () => {
  it('covers httpAndMetaChecks line 59 canonical-target-status all branches', () => {
    const makeAuditWithCanonical = (indexability?: PageAuditData['indexability']): PageAuditData => ({
      url: 'https://example.com/test', final_url: 'https://example.com/test',
      http_status: 200, response_time_ms: 100, redirect_chain: [],
      meta_tags: { canonical: 'https://example.com/test', robots: '', viewport: '', charset: '' },
      links: [], headings: [], images: [], scripts: [], stylesheets: [],
      performance: {} as never, word_count: 100, page_size_bytes: 100,
      indexability: indexability as never,
    } as unknown as PageAuditData);

    const checkNotChecked = buildMetaAndIndexabilityChecks(makeAuditWithCanonical(undefined))
      .find((c) => c.id === 'canonical-target-status');
    expect(checkNotChecked?.status).toBe('not_applicable');

    const checkPass = buildMetaAndIndexabilityChecks(makeAuditWithCanonical({ status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 200 } as never))
      .find((c) => c.id === 'canonical-target-status');
    expect(checkPass?.status).toBe('pass');

    const checkError500 = buildMetaAndIndexabilityChecks(makeAuditWithCanonical({ status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 500 } as never))
      .find((c) => c.id === 'canonical-target-status');
    expect(checkError500?.status).toBe('error');

    const checkError0 = buildMetaAndIndexabilityChecks(makeAuditWithCanonical({ status: 'indexable', reasons: [], canonical_target_checked: true, canonical_target_status: 0 } as never))
      .find((c) => c.id === 'canonical-target-status');
    expect(checkError0?.status).toBe('error');
    expect(checkError0?.evidence).toContain(i18n.t('auditProblems.unknown'));
  });

  it('covers DataForSEOCore public request contract, retries, non-retryable errors and Tauri IPC', async () => {
    const client = new DataForSEOCore('login', 'pass', 'https://api.test');

    vi.spyOn(tauri, 'isTauriEnvironment').mockReturnValue(true);
    const tauriSpy = vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue({ status: 'ok', cost: 0.05 });
    const tauriRes = await client.request('/v3/test', undefined, 'proj-1');
    expect(tauriRes.status).toBe('ok');
    expect(tauriSpy).toHaveBeenCalledWith('dataforseo_request', expect.objectContaining({
      projectId: 'proj-1',
      path: '/v3/test',
    }));

    vi.spyOn(tauri, 'isTauriEnvironment').mockReturnValue(false);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ message: 'Bad request' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(client.request('/v3/bad', undefined, 'proj-1')).rejects.toThrow();

    let attempts = 0;
    const retryFetch = vi.fn().mockImplementation(async () => {
      attempts += 1;
      return {
        ok: false, status: 429,
        headers: new Headers({ 'Retry-After': '0' }),
        json: async () => ({ message: 'Too Many Requests' }),
      };
    });
    vi.stubGlobal('fetch', retryFetch);

    await expect(client.request('/v3/retry', undefined, 'proj-1')).rejects.toThrow();
    expect(attempts).toBe(3);
  });
});
