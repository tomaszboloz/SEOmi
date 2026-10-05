import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { useCommandPaletteItems } from '@/components/Layout/commandPalette/useCommandPaletteItems';
import { normalize } from '@/components/Layout/commandPalette/commandPaletteTypes';
import { WORKSPACE_NAVIGATION } from '@/components/Layout/navigation';
import type { SeoProject } from '@/types';

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
const projects: SeoProject[] = [
  { id: 'alpha', name: 'Polska Żółć', rootUrl: 'https://alpha.test', createdAt: '2026-10-05', lastOpenedAt: '2026-10-05' },
  { id: 'beta', name: 'Second project', createdAt: '2026-10-05', lastOpenedAt: '2026-10-05' },
];
function setup(query = '') {
  const selectProject = vi.fn(); const setActiveTab = vi.fn(); const openModal = vi.fn();
  const run = vi.fn((action: () => void) => action());
  const props = { query, activeProjectId: 'alpha' as string | null, projects, selectProject, setActiveTab, openModal, run, t: ((key: string) => `translated:${key}`) as TFunction };
  return { ...renderHook(useCommandPaletteItems, { initialProps: props }), props };
}

it('provides unique project/module/action IDs and translates labels and groups', () => {
  const { result } = setup();
  const definitions = WORKSPACE_NAVIGATION.flatMap(section => section.items.filter(item => item.tab));
  expect(result.current.items.map(item => item.id)).toEqual(['new-project', 'project:alpha', 'project:beta', ...definitions.map(item => item.key), 'history', 'settings', 'ai-assistant', 'ai-connection']);
  expect(new Set(result.current.items.map(item => item.id)).size).toBe(result.current.items.length);
  expect(result.current.items.find(item => item.id === 'project:alpha')).toMatchObject({ label: 'Polska Żółć · translated:commandPalette.active', keywords: 'https://alpha.test alpha' });
  expect(result.current.items.find(item => item.id === 'project:beta')).toMatchObject({ label: 'Second project', keywords: ' beta' });
  expect(result.current.filteredItems).toBe(result.current.items);
  for (const section of WORKSPACE_NAVIGATION) for (const definition of section.items.filter(item => item.tab)) {
    expect(result.current.items.find(item => item.id === definition.key)).toMatchObject({ label: `translated:${definition.labelKey}`, group: `translated:${section.titleKey}`, icon: definition.icon });
  }
});

it('runs every module action with its exact tab and only signals semantic-map navigation', () => {
  const { result, props } = setup();
  const events = vi.fn(); window.addEventListener('seomi:open-crawl-map', events);
  try {
    for (const definition of WORKSPACE_NAVIGATION.flatMap(section => section.items.filter(item => item.tab))) {
      props.run.mockClear(); props.setActiveTab.mockClear(); events.mockClear(); sessionStorage.clear();
      result.current.items.find(item => item.id === definition.key)!.action();
      expect(props.run).toHaveBeenCalledOnce(); expect(props.setActiveTab).toHaveBeenCalledExactlyOnceWith(definition.tab);
      expect(props.openModal).not.toHaveBeenCalled(); expect(props.selectProject).not.toHaveBeenCalled();
      expect(events).toHaveBeenCalledTimes(definition.action === 'semantic-map' ? 1 : 0);
      expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBe(definition.action === 'semantic-map' ? '1' : null);
    }
  } finally { window.removeEventListener('seomi:open-crawl-map', events); }
});

it.each([['new-project', 'create-project'], ['history', 'history'], ['settings', 'settings'], ['ai-assistant', 'ai'], ['ai-connection', 'subscription']])('dispatches %s to the exact %s modal through run', (id, modal) => {
  const { result, props } = setup();
  result.current.items.find(item => item.id === id)!.action();
  expect(props.run).toHaveBeenCalledOnce(); expect(props.openModal).toHaveBeenCalledExactlyOnceWith(modal);
  expect(props.selectProject).not.toHaveBeenCalled(); expect(props.setActiveTab).not.toHaveBeenCalled();
});

it('selects each exact project and updates active labels after a project change', () => {
  const { result, props, rerender } = setup();
  for (const project of projects) result.current.items.find(item => item.id === `project:${project.id}`)!.action();
  expect(props.selectProject.mock.calls).toEqual([['alpha'], ['beta']]); expect(props.run).toHaveBeenCalledTimes(2);
  rerender({ ...props, activeProjectId: 'beta' });
  expect(result.current.items.find(item => item.id === 'project:alpha')!.label).toBe('Polska Żółć');
  expect(result.current.items.find(item => item.id === 'project:beta')!.label).toBe('Second project · translated:commandPalette.active');
});

it.each(['  ŻÓŁĆ  ', 'ALPHA.TEST', 'BETA', 'keywordworkflows', 'LIGHTHOUSE', '  '])('filters names, roots, IDs, translated groups and keywords with query %s', query => {
  const { result } = setup(query);
  const expected = result.current.items.filter(item => `${item.label} ${item.group} ${item.keywords}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  expect(result.current.filteredItems.map(item => item.id)).toEqual(expected.map(item => item.id));
  expect(result.current.filteredItems.length).toBeGreaterThan(0);
});

it('handles no matches and updates filtering while retaining stable actions', () => {
  const { result, props, rerender } = setup('unmatched unique query');
  expect(result.current.filteredItems).toEqual([]);
  const items = result.current.items;
  rerender({ ...props, query: 'settings' });
  expect(result.current.items).toBe(items);
  expect(result.current.filteredItems.map(item => item.id)).toContain('settings');
  rerender({ ...props, projects: [], activeProjectId: null, query: '' });
  expect(result.current.items.some(item => item.id.startsWith('project:'))).toBe(false);
  expect(result.current.items[0].id).toBe('new-project');
});

it('normalizes whitespace, case and Unicode without changing accents', () => {
  expect(normalize('  ŻÓŁĆ\n')).toBe('żółć'); expect(normalize('  ')).toBe('');
});

it('still navigates and sends the map event when session storage is denied', () => {
  const { result, props } = setup();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  const event = vi.fn(); window.addEventListener('seomi:open-crawl-map', event);
  try {
    result.current.items.find(item => item.id === 'semantic-map')!.action();
    expect(props.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit'); expect(event).toHaveBeenCalledOnce();
  } finally { window.removeEventListener('seomi:open-crawl-map', event); }
});
