import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildElements } from '@/components/Charts/crawlArchitecture/cytoscapeMap/buildElements';
import type { MapNode } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapTypes';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';
import { HelpPopover } from '@/components/Help/HelpPopover';

const cost = vi.hoisted(() => ({ state: null as unknown }));
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => values ? `${key}:${JSON.stringify(values)}` : key, i18n: { dir: () => 'rtl' } }),
}));
vi.mock('@/components/DataForSEO/cost/useDataForSeoCost', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/components/DataForSEO/cost/useDataForSeoCost')>()), useDataForSeoCost: () => cost.state }));

const node = (over: Partial<MapNode> = {}): MapNode => ({ id: 'n', url: 'https://example.test/a?x=1', title: 'A', status: 200, statusClass: '2xx', depth: 1, inlinks: 2, trs: null, section: 'blog', orphan: false, problem: false, ...over });

describe('crawl map element contracts', () => {
  it('emits one collapsed section and merges edges redirected to it', () => {
    const nodes = [node({ id: 'a' }), node({ id: 'b', inlinks: 1 }), node({ id: 'c', section: 'root', trs: 80 })];
    const elements = buildElements(nodes, [{ id: 'ab', source: 'a', target: 'b', links: 1 }, { id: 'ac', source: 'a', target: 'c', links: 2 }, { id: 'bc', source: 'b', target: 'c', links: 1 }], { grouped: false, collapsed: new Set(['blog']) });
    expect(elements.filter((e) => e.group === 'nodes').map((e) => e.data)).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'sec:blog', kind: 'section', label: 'blog (2)' }), expect.objectContaining({ id: 'c', kind: 'page' })]));
    expect(elements.filter((e) => e.group === 'edges').map((e) => e.data)).toEqual([expect.objectContaining({ source: 'sec:blog', target: 'c', weight: 1 + Math.log2(3) })]);
  });

  it('adds grouped parents and leaves only the least linked page unlabeled', () => {
    const nodes = Array.from({ length: 61 }, (_, i) => node({ id: `n${i}`, inlinks: i === 0 ? 100 : i === 60 ? 0 : 1, url: i === 0 ? 'invalid url' : `https://example.test/${i}` }));
    const elements = buildElements(nodes, [], { grouped: true, collapsed: new Set() });
    expect(elements.find((e) => e.data.id === 'sec:blog')?.data.kind).toBe('group');
    expect(elements.find((e) => e.data.id === 'n0')?.data.label).toBe('invalid url');
    expect(elements.find((e) => e.data.id === 'n60')?.data.label).toBe('');
  });
});

const spend = (lastCall: { endpoint: string; costUsd: number; at: string } | null = null) => ({ month: '2026-10', totalUsd: 8, calls: 2, lastCostByEndpoint: {}, lastCall });
const budget = (monthlyLimitUsd: number | null) => ({ monthlyLimitUsd, warnAtPercent: 80 });
const state = (level: 'none' | 'warning' | 'exceeded', limit: number | null, account: unknown = null, lastCall: { endpoint: string; costUsd: number; at: string } | null = null) => ({ projectId: 'project', spend: spend(lastCall), budget: budget(limit), status: { level, percent: limit === null ? null : 80, remainingUsd: limit === null ? null : 2 }, account });

describe('DataForSEO cost meter contracts', () => {
  it('stays empty without a project snapshot', () => {
    cost.state = { projectId: null, spend: null, budget: null, status: null, account: null };
    const { container } = render(<DataForSeoCostMeter />);
    expect(container.firstChild).toBeNull();
  });

  it('renders no-limit, warning, account and exceeded states', () => {
    cost.state = state('none', null);
    const view = render(<DataForSeoCostMeter />);
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.noCallsYet');
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.monthNoLimit');
    cost.state = state('warning', 10, { estimatedBalanceUsd: 4.25 }, { endpoint: '/v3/keywords', costUsd: 0.125, at: 'now' });
    view.rerender(<DataForSeoCostMeter className="extra" />);
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.warning');
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.balance');
    cost.state = state('exceeded', 5);
    view.rerender(<DataForSeoCostMeter />);
    expect(screen.getByRole('status').textContent).toContain('dataforseoCost.exceeded');
  });
});

describe('HelpPopover presentation contracts', () => {
  const content = { title: 'How', what: 'What', why: 'Why', action: '1. First\n2. Second', example: 'Example', learnMore: 'Docs' };

  it('renders RTL content, optional sections and recalculates on viewport events', () => {
    const anchor = createRef<HTMLButtonElement>();
    const bubble = createRef<HTMLDivElement>();
    render(<><button ref={anchor}>anchor</button><HelpPopover ref={bubble} id="help-x" content={content} anchor={anchor} /></>);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.getAttribute('dir')).toBe('rtl');
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Example')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new Event('scroll'));
    });
  });

  it('keeps the portal hidden until both refs exist', () => {
    const anchor = createRef<HTMLButtonElement>();
    render(<HelpPopover id="help-hidden" content={{ title: 'T', what: 'W', why: 'Y', action: 'A' }} anchor={anchor} />);
    expect(screen.getByRole('tooltip', { hidden: true }).getAttribute('style')).toContain('visibility: hidden');
  });
});
