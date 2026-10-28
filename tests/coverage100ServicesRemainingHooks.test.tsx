import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { useTrust } from '@/hooks/useTrust';
import * as alerts from '@/services/monitoringAlerts';
import { matchGscProperty } from '@/services/gscPropertyMatch';
import { scorePageAio } from '@/services/aioReadiness';
import { checkAlt } from '@/services/multimodal';
import { section, aioPage } from './aioFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { OWN_HOST, ownReport, ownSite } from './authorityFixtures';
import { diabetesPages, trustedArticle } from './eeatTrustFixtures';

const pages = ownSite();
const startUrl = `https://${OWN_HOST}/`;
const run = createCrawlRunFixture({ id: 'remaining-hooks-run', startUrl, result: createCrawlResultFixture({ pages, start_url: startUrl }) });
const trustStartUrl = 'https://diabetes.test/';
const trustPages = [trustedArticle(diabetesPages()[2])];
const trustPagesWithoutSchema = trustPages.map((page) => ({ ...page, schema_references: [] }));
const trustRun1 = createCrawlRunFixture({ id: 'remaining-trust-run-1', startUrl: trustStartUrl, result: createCrawlResultFixture({ pages: trustPages, start_url: trustStartUrl }) });
const trustRun2 = createCrawlRunFixture({ id: 'remaining-trust-run-2', startUrl: trustStartUrl, result: createCrawlResultFixture({ pages: trustPagesWithoutSchema, start_url: trustStartUrl }) });

describe('remaining hook and service coverage edges', () => {
  it('keeps a non-Error reference failure message honest', async () => {
    const runner = vi.fn(async () => { throw 'runner failed'; });
    const view = renderHook(() => useTopicalAuthority({ pages, startUrl, sfs: ownReport(pages), run, projectId: 'remaining-hook-error', runner }));
    await act(async () => { await view.result.current.build(); });
    expect(view.result.current.state.error).toBe('runner failed');
  });

  it('does not alert twice when the same trust run is persisted again', async () => {
    localStorage.clear();
    const alert = vi.spyOn(alerts, 'monitorScoreDrop').mockResolvedValue({ alert: null, delivered: false, persisted: false, duplicate: false, emailConfigured: false });
    const first = renderHook(({ input, crawlRun }) => useTrust(input, trustStartUrl, crawlRun, 'remaining-trust-run'), { initialProps: { input: trustPages, crawlRun: trustRun1 } });
    await act(async () => { await Promise.resolve(); });
    expect(first.result.current.report).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
    first.unmount();
    const second = renderHook(({ input, crawlRun }) => useTrust(input, trustStartUrl, crawlRun, 'remaining-trust-run'), { initialProps: { input: trustPagesWithoutSchema, crawlRun: trustRun2 } });
    await act(async () => { await Promise.resolve(); });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith('remaining-trust-run', 'trust', expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), 'remaining-trust-run-2');
    second.rerender({ input: [...trustPagesWithoutSchema], crawlRun: trustRun2 });
    await act(async () => { await Promise.resolve(); });
    expect(alert).toHaveBeenCalledTimes(1);
    second.unmount();
    alert.mockRestore();
  });

  it('uses the root pathname fallback when URL exposes an empty pathname', () => {
    const NativeURL = URL;
    class EmptyPathURL extends NativeURL { get pathname() { return ''; } }
    vi.stubGlobal('URL', EmptyPathURL);
    try {
      expect(matchGscProperty([{ siteUrl: 'https://site.test/', permissionLevel: 'siteOwner' }], 'https://site.test')).toBe('https://site.test/');
    } finally { vi.unstubAllGlobals(); }
  });

  it('uses the defensive empty-section fallback after a section disappears', () => {
    let reads = 0;
    const page = aioPage('https://a.test/disappearing', [section('Facts', ['A fact is useful.'])]);
    Object.defineProperty(page, 'rag_sections', { configurable: true, get: () => (reads++ < 2 ? [section('Facts', ['A fact is useful.'])] : undefined) });
    expect(scorePageAio(page as never).chunkCount).toBe(0);
  });

  it('keeps an absent context separate from unrelated context', () => {
    expect(checkAlt({ src: 'image.png', alt: 'A descriptive image' }).contextOverlap).toBeNull();
  });
});
