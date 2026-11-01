import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { CrawlAuthorityTab } from '@/components/Domain/crawlResults/authority/CrawlAuthorityTab';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import type { WikidataLookup } from '@/services/entityIds';
import type { ReferenceTaxonomy } from '@/services/topicalAuthority';
import { readTaxonomy, writeTaxonomy } from '@/services/topicalAuthorityMonitoring';
import { linkPillarEntities, type PillarLookup } from '@/services/topicalAuthorityReference';
import { NOW, OWN_HOST, ownReport, ownSite, referenceTaxonomy } from './authorityFixtures';

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const taxonomy = () => referenceTaxonomy(pages)!;
const IDLE = { running: false, progress: null, failure: null, error: null };
beforeEach(() => localStorage.clear());

const ok = (...candidates: Array<[string, string]>): WikidataLookup => ({ status: 'ok', fetchedAt: NOW, candidates: candidates.map(([id, label]) => ({ id, label, description: '' })) });

describe('optional Knowledge Graph link for pillars (#57)', () => {
  it('marks exact matches, flags search-only hits for review and never reads a failure as "no entity"', async () => {
    const base: ReferenceTaxonomy = { ...taxonomy(), pillars: ['Alpha', 'Beta', 'Gamma', 'Delta', 'Eps'].map((label) => ({ id: label, label, importance: 1 })) };
    const [first, second, third] = base.pillars;
    const answers = new Map<string, WikidataLookup>([[first.label, ok(['Q1', first.label.toUpperCase()])], [second.label, ok(['Q2', 'Something else'])], [third.label, { status: 'error', candidates: [], error: 'offline' }]]);
    const lookup: PillarLookup = async (label) => answers.get(label) ?? ok();
    const out = await linkPillarEntities(base, lookup);
    expect(out.taxonomy.pillars[0]).toMatchObject({ entityId: 'Q1', entityMatch: 'exact' });
    expect(out.taxonomy.pillars[1]).toMatchObject({ entityId: 'Q2', entityMatch: 'search' });
    expect(out.taxonomy.pillars[2].entityId).toBeUndefined();
    expect(out).toMatchObject({ linked: 2, review: 1, failed: 1 });
    expect(out.taxonomy.pillars.slice(3).every((pillar) => !pillar.entityId)).toBe(true);
    expect(out.taxonomy.pillars).toHaveLength(5);
    expect(base.pillars[0].entityId).toBeUndefined();
  });

  it('stops at the cap and when cancelled', async () => {
    const many = { ...taxonomy(), pillars: Array.from({ length: 15 }, (_, i) => ({ id: `p${i}`, label: `Pillar ${i}`, importance: 1 })) };
    const lookup = vi.fn(async (label: string) => ok(['Q9', label]));
    expect((await linkPillarEntities(many, lookup)).linked).toBe(12);
    expect(lookup).toHaveBeenCalledTimes(12);
    const controller = new AbortController();
    controller.abort();
    const none = await linkPillarEntities(many, lookup, controller.signal);
    expect(none.linked).toBe(0);
    expect(none.taxonomy.pillars).toHaveLength(15);
  });

  it('persists links from the hook and the panel shows the summary', async () => {
    const sfs = ownReport(pages);
    const base = { ...taxonomy(), builtAt: new Date(NOW).toISOString() };
    writeTaxonomy('kg', base);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const entityLookup: PillarLookup = async (label) => ok(['Q5', label]);
    const hook = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs, projectId: 'kg', entityLookup }));
    await act(async () => { await hook.result.current.linkPillars(); });
    expect(hook.result.current.linking?.linked).toBe(base.pillars.length);
    expect(readTaxonomy('kg', Date.parse(NOW))?.pillars.every((pillar) => pillar.entityId === 'Q5')).toBe(true);
    const onLink = vi.fn();
    render(<ReferenceMapPanel taxonomy={hook.result.current.taxonomy} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} onLinkPillars={onLink} />);
    expect(document.body.textContent).toMatch(new RegExp(`${base.pillars.length} pillars linked to Wikidata items, 0 to review`));
    fireEvent.click(screen.getByRole('button', { name: /Link pillars to Wikidata/ }));
    expect(onLink).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('wires the button in the Authority tab to the lookup without breaking when the public feed is unavailable', async () => {
    writeTaxonomy('tab', { ...taxonomy(), builtAt: new Date().toISOString() });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    render(<CrawlAuthorityTab pages={pages} startUrl={START} projectId="tab" />);
    fireEvent.click(screen.getByRole('button', { name: /Link pillars to Wikidata/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Link pillars to Wikidata/ })).toBeTruthy());
    vi.useRealTimers();
  });

  it('does nothing without a map and hides the button when unwired', async () => {
    const hook = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs: ownReport(pages), projectId: 'none' }));
    await act(async () => { await hook.result.current.linkPillars(); });
    expect(hook.result.current.linking).toBeNull();
    render(<ReferenceMapPanel taxonomy={taxonomy()} projectId={null} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Wikidata/ })).toBeNull();
  });
});
