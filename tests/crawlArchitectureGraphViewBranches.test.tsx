import { render, screen, fireEvent } from '@testing-library/react';
import { zoomIdentity } from 'd3-zoom';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureGraphView } from '@/components/Charts/crawlArchitecture/CrawlArchitectureGraphView';

const m = vi.hoisted(() => ({ zoom: { current: null as unknown }, controls: {} as { scaleView: (f: number) => void; resetView: () => void }, sidebar: vi.fn() }));
vi.mock('@/components/Charts/crawlArchitecture/useCrawlArchitectureSimulation', () => ({ useCrawlArchitectureSimulation: () => ({ zoomRef: m.zoom }) }));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureControls', () => ({ CrawlArchitectureControls: (p: typeof m.controls) => { m.controls = p; return <div data-testid="controls" />; } }));
vi.mock('@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar', () => ({ CrawlArchitectureSidebar: (p: object) => { m.sidebar(p); return <div data-testid="sidebar" />; } }));

const node = (id: string, count: number, orphan = false) => ({ id, page: { url: `https://x.test/${id}` }, clusterLabel: `cl-${id}`, semanticSignalCount: count, orphan });
const t = (k: string, o?: object): string => String(i18n.t(k, o as never));
const make = (nodes: unknown[], linkMode = 'content') => ({ visibleNodes: nodes, setSelectedId: vi.fn(), graph: { clusters: [] }, preferences: { linkMode }, setPreferences: vi.fn() });
beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); m.zoom.current = null; });

it('lists pages with localized plural forms and selects a node on click', () => {
  const state = make([node('a', 1), node('b', 3), node('c', 5), node('d', 12), node('e', 22)]);
  render(<CrawlArchitectureGraphView state={state} crawlMode="full" />);
  const forms: [number, string][] = [[1, 'one'], [3, 'few'], [5, 'many'], [12, 'many'], [22, 'few']];
  for (const [count, form] of forms) expect(screen.getAllByText(new RegExp(`· ${t(`mapUi.plural.term.${form}`, { count }).replace(/[()]/g, '\\$&')}$`)).length).toBeGreaterThan(0);
  expect(screen.getByText(t('mapUi.pageList', { count: 5 }))).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '/a' }));
  expect(state.setSelectedId).toHaveBeenCalledWith('a');
  expect(m.sidebar).toHaveBeenCalledWith(expect.objectContaining({ crawlMode: 'full' }));
  expect(screen.getByRole('img', { name: t('mapUi.svgAria') })).toBeTruthy();
});

it.each([['content', 'mapUi.orphanContent'], ['all', 'mapUi.orphanGraph']])('flags orphans in %s mode', (linkMode, key) => {
  render(<CrawlArchitectureGraphView state={make([node('a', 2, true), node('b', 2, false)], linkMode)} crawlMode="full" />);
  expect(screen.getAllByText(t(key))).toHaveLength(1);
});

it('ignores zoom controls until the zoom behaviour exists, then forwards them to d3', () => {
  render(<CrawlArchitectureGraphView state={make([])} crawlMode="full" />);
  expect(() => { m.controls.scaleView(2); m.controls.resetView(); }).not.toThrow();
  const transform = vi.fn();
  const scaleBy = vi.fn();
  m.zoom.current = { transform, scaleBy };
  m.controls.scaleView(1.5);
  expect(scaleBy.mock.calls[0][1]).toBe(1.5);
  m.controls.resetView();
  expect(transform.mock.calls[0][1]).toBe(zoomIdentity);
});
