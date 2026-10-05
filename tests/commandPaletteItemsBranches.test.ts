import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { useCommandPaletteItems } from '@/components/Layout/commandPalette/useCommandPaletteItems';
import { WORKSPACE_NAVIGATION } from '@/components/Layout/navigation';

const fns = { selectProject: vi.fn(), setActiveTab: vi.fn(), openModal: vi.fn(), run: vi.fn((action: () => void) => action()) };
const projects = [{ id: 'p1', name: 'Alpha', rootUrl: 'https://alpha.test' }, { id: 'p2', name: 'Beta' }] as never;
const render = (query = '', activeProjectId: string | null = 'p1') =>
  renderHook(() => useCommandPaletteItems({ query, activeProjectId, projects, ...fns, t: i18n.t.bind(i18n) as never })).result.current;
beforeEach(async () => { await i18n.changeLanguage('en'); Object.values(fns).forEach((f) => f.mockClear()); sessionStorage.clear(); });

it('orders project items before modules and workspace actions with an active marker', () => {
  const { items } = render();
  expect(items[0].id).toBe('new-project');
  expect(items[1].label).toBe(`Alpha · ${i18n.t('commandPalette.active')}`);
  expect(items[2].label).toBe('Beta');
  expect(items[2].keywords).toBe(' p2');
  expect(items.slice(-4).map((i) => i.id)).toEqual(['history', 'settings', 'ai-assistant', 'ai-connection']);
});

it('routes project and workspace actions through run', () => {
  const { items } = render('', null);
  items.find((i) => i.id === 'new-project')!.action();
  items.find((i) => i.id === 'project:p2')!.action();
  items.find((i) => i.id === 'history')!.action();
  items.find((i) => i.id === 'settings')!.action();
  items.find((i) => i.id === 'ai-assistant')!.action();
  items.find((i) => i.id === 'ai-connection')!.action();
  expect(fns.run).toHaveBeenCalledTimes(6);
  expect(fns.selectProject).toHaveBeenCalledWith('p2');
  expect(fns.openModal.mock.calls.map((c) => c[0])).toEqual(['create-project', 'history', 'settings', 'ai', 'subscription']);
  expect(items.find((i) => i.id === 'project:p2')!.label).toBe('Beta');
});

it('navigates to module tabs and flags the semantic map for the crawl view', () => {
  const { items } = render();
  const listener = vi.fn();
  window.addEventListener('seomi:open-crawl-map', listener);
  items.find((i) => i.id === 'overview')!.action();
  expect(fns.setActiveTab).toHaveBeenCalledWith('overview');
  expect(listener).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBeNull();
  items.find((i) => i.id === 'semantic-map')!.action();
  expect(fns.setActiveTab).toHaveBeenLastCalledWith('site-audit');
  expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBe('1');
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener('seomi:open-crawl-map', listener);
  const withTab = WORKSPACE_NAVIGATION.flatMap((s) => s.items).filter((d) => d.tab).length;
  expect(items.filter((i) => !['new-project', 'history', 'settings', 'ai-assistant', 'ai-connection'].includes(i.id) && !i.id.startsWith('project:'))).toHaveLength(withTab);
});

it('filters case-insensitively across label, group and keywords', () => {
  expect(render('  ALPHA.test ').filteredItems.map((i) => i.id)).toEqual(['project:p1']);
  expect(render('claude codex').filteredItems.map((i) => i.id)).toEqual(['ai-connection']);
  expect(render('   ').filteredItems).toHaveLength(render().items.length);
  expect(render('zzzz-no-match').filteredItems).toEqual([]);
});
