import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CytoscapeMapView } from '@/components/Charts/crawlArchitecture/cytoscapeMap/CytoscapeMapView';
import { MapDetails, MapTooltip } from '@/components/Charts/crawlArchitecture/cytoscapeMap/MapDetails';
import { MapTable } from '@/components/Charts/crawlArchitecture/cytoscapeMap/MapTable';
import { MapToolbar } from '@/components/Charts/crawlArchitecture/cytoscapeMap/MapToolbar';
import { emptyFilters, type LayoutMode, type MapFilters, type MapNode } from '@/components/Charts/crawlArchitecture/cytoscapeMap/mapTypes';
import { fakeInstances } from './fixtures/fakeCytoscape';
import { createCrawlPageFixture } from './fixtures/crawl';
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureControls', () => ({
  CrawlArchitectureControls: (p: { scaleView: (f: number) => void; resetView: () => void }) => <div><button onClick={() => p.scaleView(2)}>zoom</button><button onClick={p.resetView}>fit</button></div>,
}));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar', () => ({ CrawlArchitectureSidebar: () => <div data-testid="sidebar" /> }));
vi.mock('@/components/Charts/crawlArchitecture/GraphEvidencePanel', () => ({ GraphEvidencePanel: () => <div data-testid="evidence" /> }));

const mapNode = (over: Partial<MapNode> = {}): MapNode => ({ id: 'p0', url: 'https://a.test/blog/x', title: 'X', status: 200, statusClass: '2xx', depth: 1, inlinks: 3, trs: 72.4, section: '/blog', orphan: false, problem: false, ...over });
const t = (key: string, options?: object) => String(i18n.t(key, options as never));

beforeEach(async () => { await i18n.changeLanguage('en'); fakeInstances.length = 0; });

describe('MapDetails and MapTooltip', () => {
  it('prompts for a selection when nothing is selected', () => {
    render(<MapDetails node={undefined} />);
    expect(screen.getByText(t('mapUi.cy.detailsHint'))).toBeTruthy();
  });

  it('shows status, depth, rounded TRS and problem flag', () => {
    render(<MapDetails node={mapNode()} />);
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText(t('mapUi.cy.no'))).toBeTruthy();
  });

  it('shows n/a TRS and problem yes', () => {
    render(<MapDetails node={mapNode({ trs: null, problem: true })} />);
    expect(screen.getByText(t('mapUi.cy.noTrs'))).toBeTruthy();
    expect(screen.getByText(t('mapUi.cy.yes'))).toBeTruthy();
  });

  it('renders the hover tooltip next to the cursor', () => {
    render(<MapTooltip node={mapNode()} x={10} y={20} />);
    const tip = screen.getByRole('tooltip');
    expect(tip.style.left).toBe('22px');
    expect(tip.textContent).toContain(t('mapUi.cy.tooltip', { status: 200, depth: 1, inlinks: 3 }));
  });
});

describe('MapTable', () => {
  it('lists every page and selects through the url button', () => {
    const onSelect = vi.fn();
    render(<MapTable nodes={[mapNode(), mapNode({ id: 'p1', url: 'https://a.test/y', trs: null, problem: true })]} onSelect={onSelect} />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    fireEvent.click(within(table).getByRole('button', { name: 'https://a.test/y' }));
    expect(onSelect).toHaveBeenCalledWith('p1');
  });
});

describe('MapToolbar', () => {
  const setup = (over: Partial<Parameters<typeof MapToolbar>[0]> = {}) => {
    const spies = { setLayoutMode: vi.fn<(mode: LayoutMode) => void>(), setFilters: vi.fn<(filters: MapFilters) => void>(), setAllCollapsed: vi.fn<(collapse: boolean) => void>(), setHighlight: vi.fn<(value: string) => void>() };
    const props = { layoutMode: 'force' as const, filters: emptyFilters(), maxDepth: 2, highlight: '', matchCount: 0, hasTrs: false, ...spies, ...over };
    render(<MapToolbar {...props} />);
    return spies;
  };

  it('switches layout and collapses or expands sections', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: t('mapUi.cy.layoutHierarchy') }));
    fireEvent.click(screen.getByRole('button', { name: t('mapUi.cy.layoutForce') }));
    fireEvent.click(screen.getByRole('button', { name: t('mapUi.cy.collapseAll') }));
    fireEvent.click(screen.getByRole('button', { name: t('mapUi.cy.expandAll') }));
    expect(p.setLayoutMode.mock.calls).toEqual([['hierarchy'], ['force']]);
    expect(p.setAllCollapsed.mock.calls).toEqual([[true], [false]]);
  });

  it('updates filters for depth, problems and status classes', () => {
    const p = setup();
    fireEvent.change(screen.getByLabelText(t('mapUi.cy.depthLabel')), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(t('mapUi.cy.depthLabel')), { target: { value: 'all' } });
    fireEvent.click(screen.getByLabelText(t('mapUi.cy.problemsOnly')));
    fireEvent.click(screen.getByRole('button', { name: '4xx' }));
    expect(p.setFilters.mock.calls.map(([f]) => f)).toEqual([
      { ...emptyFilters(), maxDepth: 1 }, emptyFilters(), { ...emptyFilters(), problemsOnly: true },
      { ...emptyFilters(), statuses: ['2xx', '3xx', '5xx', 'other'] },
    ]);
  });

  it('re-enables a status class that was switched off', () => {
    const p = setup({ filters: { ...emptyFilters(), statuses: ['2xx'] } });
    fireEvent.click(screen.getByRole('button', { name: '3xx' }));
    expect(p.setFilters).toHaveBeenCalledWith({ ...emptyFilters(), statuses: ['2xx', '3xx'] });
  });

  it('reports highlight matches and the colour legend mode', () => {
    const p = setup({ highlight: 'blog', matchCount: 4, hasTrs: true });
    fireEvent.change(screen.getByPlaceholderText(t('mapUi.cy.highlightPlaceholder')), { target: { value: 'b' } });
    expect(p.setHighlight).toHaveBeenCalledWith('b');
    expect(screen.getByRole('status').textContent).toBe(t('mapUi.cy.matches', { count: 4 }));
    expect(screen.getByText(t('mapUi.cy.colorTrs'), { exact: false })).toBeTruthy();
  });

  it('explains the status colouring when TRS is unavailable', () => {
    setup();
    expect(screen.getByText(t('mapUi.cy.colorStatus'), { exact: false })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('CytoscapeMapView', () => {
  const pages = ['/blog/a', '/blog/b'].map((path) => createCrawlPageFixture({ url: `https://a.test${path}`, final_url: `https://a.test${path}` }));
  const node = (id: string, page: (typeof pages)[number]) => ({ id, page, clusterId: 'c', clusterLabel: 'C', semanticSignalCount: 1, incomingContentLinks: 1, orphan: false });
  const baseState = (over: object = {}) => ({
    visibleNodes: pages.map((page, i) => node(`page-${i}`, page)), visibleEdges: [{ id: 'e', source: 'page-0', target: 'page-1', anchors: [], links: 1 }],
    setSelectedId: vi.fn(), selectedId: null, graph: { clusters: [] }, preferences: {}, setPreferences: vi.fn(), diagnosis: null, ...over,
  });

  it('renders the map container, helper panels, table and evidence', () => {
    render(<CytoscapeMapView state={baseState()} crawlMode="http" pages={pages} startUrl="https://a.test/" />);
    expect(screen.getByRole('img', { name: t('mapUi.cy.mapAria') })).toBeTruthy();
    expect(fakeInstances).toHaveLength(1);
    expect(screen.getByTestId('sidebar')).toBeTruthy();
    expect(screen.getByTestId('evidence')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'https://a.test/blog/a' })).toHaveLength(1);
  });

  it('wires zoom buttons, table selection and details for the selected page', () => {
    const state = baseState({ selectedId: 'page-1' });
    render(<CytoscapeMapView state={state} crawlMode="http" />);
    fireEvent.click(screen.getByText('zoom'));
    fireEvent.click(screen.getByText('fit'));
    fireEvent.click(screen.getByRole('button', { name: 'https://a.test/blog/a' }));
    expect(fakeInstances[0].zoomCalls).toHaveLength(1);
    expect(fakeInstances[0].fitCalls).toHaveLength(1);
    expect(state.setSelectedId).toHaveBeenCalledWith('page-0');
    expect(screen.getByRole('region', { name: t('mapUi.cy.detailsTitle') })).toBeTruthy();
  });

  it('shows a tooltip while a known page is hovered and hides it afterwards', () => {
    render(<CytoscapeMapView state={baseState()} crawlMode="http" pages={pages} startUrl="https://a.test/" />);
    const fire = (event: string, payload: unknown) => act(() => fakeInstances[0].emit(event, payload, event === 'mouseover' ? 'node[kind = "page"]' : 'node'));
    expect(screen.queryByRole('tooltip')).toBeNull();
    fire('mouseover', { target: { id: () => 'unknown', data: () => ({}) }, renderedPosition: { x: 1, y: 1 } });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fire('mouseover', { target: { id: () => 'page-0', data: () => ({}) }, renderedPosition: { x: 1, y: 2 } });
    expect(screen.getByRole('tooltip').textContent).toContain('https://a.test/blog/a');
    fire('mouseout', {});
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
