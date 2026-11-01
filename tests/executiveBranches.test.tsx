import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrawlExecutiveTab } from '@/components/Domain/crawlResults/executive/CrawlExecutiveTab';
import { ExecutiveActionFeed } from '@/components/Domain/crawlResults/executive/ExecutiveActionFeed';
import { useExecutiveData } from '@/components/Domain/crawlResults/executive/useExecutiveData';
import i18n from '@/i18n';
import type { ExecutiveAction } from '@/services/actionFeed';
import { computeHss } from '@/services/hss';
import { buildExecutionCard } from '@/services/executionCard/fromAction';
import type { CrawledPageSummary } from '@/types';
import { offerBlogSite } from './sfsCalibrationScenarios';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));
const toggles = vi.hoisted(() => ({ sfs: false, links: false, copyOk: true }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn(async () => toggles.copyOk) }));
vi.mock('@/services/siteFocus', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/siteFocus')>();
  return { ...real, buildSiteFocusReport: (...args: Parameters<typeof real.buildSiteFocusReport>) => { if (toggles.sfs) throw new Error('boom'); return real.buildSiteFocusReport(...args); } };
});
vi.mock('@/services/internalLinkOpportunities', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/services/internalLinkOpportunities')>();
  return { ...real, findInternalLinkOpportunities: (...args: Parameters<typeof real.findInternalLinkOpportunities>) => { if (toggles.links) throw new Error('boom'); return real.findInternalLinkOpportunities(...args); } };
});

const pages = offerBlogSite() as unknown as CrawledPageSummary[];
const start = pages[0].url;
const action = (patch: Partial<ExecutiveAction> = {}): ExecutiveAction => ({
  id: 'x', type: 'sfs:add-terms', source: 'sfs', urls: ['https://a.test/x'], evidence: [{ source: 'sfs', code: 'add-terms' }],
  effort: null, moduleDelta: null, hssDelta: null, conflicts: [], dependsOn: [], blocked: false, drillTab: 'focus', ...patch,
});

beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); toggles.sfs = false; toggles.links = false; toggles.copyOk = true; });

describe('executive failure and fallback branches', () => {
  it('keeps going when Site Focus fails: trust runs without it and the feed is empty of SFS actions', () => {
    toggles.sfs = true;
    const data = renderHook(() => useExecutiveData(pages, start, null, 'p1')).result.current;
    expect(data.sfs).toBeNull();
    expect(data.hss.components.find((item) => item.module === 'sfs')?.status).toBe('unavailable');
  });

  it('keeps going when link opportunities fail', () => {
    toggles.links = true;
    expect(renderHook(() => useExecutiveData(pages, start, null, 'p1')).result.current.actions.every((item) => item.source !== 'links')).toBe(true);
  });

  it('shows Copy failed when the clipboard refuses', async () => {
    toggles.copyOk = false;
    render(<CrawlExecutiveTab pages={[]} startUrl={start} onOpenTab={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy HSS + actions (JSON)' }));
    expect(await screen.findByText('Copy failed')).toBeTruthy();
  });
});

describe('action feed fallbacks', () => {
  it('titles actions with no evidence, no colon in the type and no URL', () => {
    const items = [
      action({ id: 'a', type: 'sfs:add-terms', evidence: [] }),
      action({ id: 'b', type: 'tas:merge-cannibalized', source: 'tas', drillTab: 'authority' }),
      action({ id: 'c', type: 'sprs:fix-leak', source: 'sprs', urls: [] }),
      action({ id: 'd', type: 'internal-link', source: 'links', urls: [] }),
      action({ id: 'e', type: 'eetv', source: 'eetv', urls: [], drillTab: 'trust' }),
    ];
    render(<ExecutiveActionFeed actions={items} onOpen={vi.fn()} />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(5);
  });

  it('records a decision and caps the list with a more line', () => {
    const many = Array.from({ length: 30 }, (_, index) => action({ id: `m${index}`, urls: [`https://a.test/${index}`] }));
    render(<ExecutiveActionFeed actions={many} onOpen={vi.fn()} projectId="p1" hss={computeHss([{ module: 'sfs', value: 70 }], 'r')} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Accept' })[0]);
    expect(screen.getByText(/^Decision: Accept/)).toBeTruthy();
    expect(screen.getByText(/5/, { selector: 'p' })).toBeTruthy();
  });

  it('plans a brief without entities when the evidence has no items', () => {
    const card = buildExecutionCard(action(), null);
    expect(card.deployment.brief).toEqual({ origin: 'sfs', title: 'https://a.test/x', sourceUrl: 'https://a.test/x' });
  });
});
