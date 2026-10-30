import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { taxonomyMatchesCore, writeTaxonomy } from '@/services/topicalAuthorityMonitoring';
import { runReference } from '@/services/topicalAuthorityReference';
import { COMPETITORS, NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const map = () => referenceTaxonomy(pages)!;
const IDLE = { running: false, progress: null, failure: null, error: null };
beforeEach(() => localStorage.clear());

describe('reference map market identity (#57 GEM-57-07)', () => {
  it('rejects a cached map from another SERP market; unknown market stays usable', () => {
    const base = map();
    const core = { coreLabel: base.coreLabel, language: base.language };
    const pl = { ...base, market: { country: 'PL', language: 'pl' } };
    expect(taxonomyMatchesCore(pl, { ...core, market: { country: 'pl', language: 'PL' } })).toBe(true);
    expect(taxonomyMatchesCore(pl, { ...core, market: { country: 'DE', language: 'pl' } })).toBe(false);
    expect(taxonomyMatchesCore(pl, { ...core, market: { country: 'PL', language: 'en' } })).toBe(false);
    expect(taxonomyMatchesCore(base, { ...core, market: { country: 'DE', language: 'de' } })).toBe(true);
    expect(taxonomyMatchesCore(pl, core)).toBe(true);
  });

  it('applies a cached map only in the market it was built for', () => {
    writeTaxonomy('mk-1', { ...map(), builtAt: new Date().toISOString(), market: { country: 'PL', language: 'pl' } });
    const sfs = ownReport(pages);
    const de = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs, projectId: 'mk-1', market: () => ({ country: 'DE', language: 'de' }) }));
    expect(de.result.current.taxonomy).toBeNull();
    const pl = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs, projectId: 'mk-1', market: () => ({ country: 'PL', language: 'pl' }) }));
    expect(pl.result.current.taxonomy).not.toBeNull();
  });

  it('collects SERP questions into the map built by the runner', async () => {
    const sfs = ownReport(pages);
    const outcome = await runReference({
      fetchSerp: async () => ({ source: 'dataforseo', hits: COMPETITORS.map((item, index) => ({ rank: index + 1, url: `https://${item.domain}/`, domain: item.domain })), questions: ['How do you descale an espresso machine?'] }),
      crawlSite: async ({ url }) => ({ pages: COMPETITORS.find((item) => url.includes(item.domain))?.pages ?? [] }),
      now: () => NOW,
    }, { report: sfs, startUrl: START, pages, maxQueries: 1 });
    expect(outcome.status).toBe('ok');
    if (outcome.status === 'ok') expect(outcome.taxonomy.paaCount).toBe(1);
  });
});

describe('ReferenceMapPanel PAA opt-in', () => {
  it('passes the opt-in to the build and states the PAA source honestly', () => {
    const onBuild = vi.fn();
    const view = render(<ReferenceMapPanel taxonomy={null} state={IDLE} onBuild={onBuild} onCancel={vi.fn()} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onBuild).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button'));
    expect(onBuild).toHaveBeenLastCalledWith(true);
    view.rerender(<ReferenceMapPanel taxonomy={{ ...map(), paaCount: 0 }} state={IDLE} onBuild={onBuild} onCancel={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(/No People Also Ask source/)).toBeTruthy();
    view.rerender(<ReferenceMapPanel taxonomy={{ ...map(), paaCount: 4 }} state={{ ...IDLE, running: true }} onBuild={onBuild} onCancel={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText(/4 People Also Ask questions/)).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
  });
});
