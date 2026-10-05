import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureBottomNav } from '@/components/Charts/crawlArchitecture/CrawlArchitectureBottomNav';
import { useUIStore } from '@/stores/uiStore';
import type { MapView } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';

const ui = useUIStore.getState();
const t = (k: string, o?: object): string => String(i18n.t(k, o as never));
const ids: MapView[] = ['graph', 'directory', 'plan'];
const show = (activeView: MapView = 'graph', collapsed = false) => {
  useUIStore.setState({ sidebarCollapsed: collapsed });
  const setActiveView = vi.fn();
  const ref = createRef<HTMLDivElement>();
  const view = render(<CrawlArchitectureBottomNav activeView={activeView} setActiveView={setActiveView} bottomMapTabsRef={ref} />);
  return { setActiveView, ref, ...view };
};
const tab = (id: MapView) => document.querySelectorAll('button[data-map-view]')[ids.indexOf(id)] as HTMLButtonElement;
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { useUIStore.setState(ui); });

it('marks the active view and switches views from the tab buttons', () => {
  const { setActiveView } = show('directory');
  expect(tab('directory').getAttribute('aria-pressed')).toBe('true');
  expect(tab('directory').getAttribute('aria-current')).toBe('page');
  expect(tab('graph').getAttribute('aria-pressed')).toBe('false');
  expect(tab('graph').hasAttribute('aria-current')).toBe(false);
  fireEvent.click(tab('plan'));
  expect(setActiveView).toHaveBeenCalledWith('plan');
  expect(screen.getByText(/2\/3/).textContent).toContain('2/3');
});

it('switches views from the compact select', () => {
  const { setActiveView } = show();
  fireEvent.change(screen.getByLabelText(t('mapUi.chooseMapView')), { target: { value: 'plan' } });
  expect(setActiveView).toHaveBeenCalledWith('plan');
});

it.each([
  ['ArrowRight', 'graph', 'directory'], ['ArrowLeft', 'graph', 'plan'], ['Home', 'plan', 'graph'], ['End', 'graph', 'plan'],
])('navigates with %s from %s to %s', (key, from, to) => {
  const { setActiveView, ref } = show(from as MapView);
  fireEvent.keyDown(ref.current!, { key });
  expect(setActiveView).toHaveBeenCalledWith(to);
});

it('ignores other keys and key events coming from the select', () => {
  const { setActiveView, ref } = show();
  fireEvent.keyDown(ref.current!, { key: 'a' });
  fireEvent.keyDown(screen.getByLabelText(t('mapUi.chooseMapView')), { key: 'ArrowRight' });
  expect(setActiveView).not.toHaveBeenCalled();
});

it('scrolls the tab strip by a fixed step', () => {
  const { ref } = show();
  const scrollBy = vi.fn();
  ref.current!.scrollBy = scrollBy;
  fireEvent.click(screen.getByRole('button', { name: t('mapUi.scrollBottomLeft') }));
  fireEvent.click(screen.getByRole('button', { name: t('mapUi.scrollBottomRight') }));
  expect(scrollBy.mock.calls.map((c) => c[0].left)).toEqual([-260, 260]);
});

it.each([['crawl-results', 'mapUi.backToResults'], ['crawl-map-section', 'mapUi.backToMapStart']])('scrolls to and focuses #%s', (id, key) => {
  show();
  const target = document.createElement('section');
  target.id = id; target.tabIndex = -1;
  const scrollIntoView = vi.fn();
  target.scrollIntoView = scrollIntoView;
  document.body.appendChild(target);
  fireEvent.click(screen.getByRole('button', { name: t(key) }));
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  expect(document.activeElement).toBe(target);
  target.remove();
});

it('uses instant scrolling under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { ref } = show();
  const scrollBy = vi.fn();
  ref.current!.scrollBy = scrollBy;
  fireEvent.click(screen.getByRole('button', { name: t('mapUi.scrollBottomLeft') }));
  expect(scrollBy).toHaveBeenCalledWith({ left: -260, behavior: 'auto' });
  vi.unstubAllGlobals();
});
