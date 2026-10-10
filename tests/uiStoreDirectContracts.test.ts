import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from '@/stores/uiStore';

const key = (id: string) => `seomi_project_${id}_sidebar_sections_v1`;
const reset = () => useUIStore.setState({ sidebarCollapsed: false, collapsedSections: {}, activeModal: null, commandPaletteOpen: false, splitPaneRatio: 50 });

beforeEach(() => { localStorage.clear(); reset(); });
afterEach(() => { localStorage.clear(); reset(); });

describe('direct UI store state and persistence contracts', () => {
  it('persists explicit and toggled sidebar preferences', () => {
    const state = useUIStore.getState();
    state.setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    expect(localStorage.getItem('seomi_sidebar_collapsed_v1')).toBe('true');
    state.toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    expect(localStorage.getItem('seomi_sidebar_collapsed_v1')).toBe('false');
  });
  it('opens and closes each modal and the command palette independently', () => {
    const state = useUIStore.getState();
    for (const modal of ['settings', 'ai', 'login', 'subscription', 'history', 'create-project', null] as const) {
      state.openModal(modal);
      expect(useUIStore.getState().activeModal).toBe(modal);
    }
    state.openModal('settings');
    state.openCommandPalette();
    expect(useUIStore.getState()).toMatchObject({ activeModal: 'settings', commandPaletteOpen: true });
    state.closeModal();
    expect(useUIStore.getState()).toMatchObject({ activeModal: null, commandPaletteOpen: true });
    state.closeCommandPalette();
    state.setSplitPaneRatio(65);
    expect(useUIStore.getState()).toMatchObject({ commandPaletteOpen: false, splitPaneRatio: 65 });
  });
  it('hydrates only boolean project preferences and preserves explicit migration choices', () => {
    localStorage.setItem(key('a'), JSON.stringify({ 'page-audit': true, 'audit-workspace': false, other: 'invalid', count: 1 }));
    useUIStore.getState().hydrateSidebarSections('a');
    expect(useUIStore.getState().collapsedSections).toEqual({ 'page-audit': true, 'audit-workspace': false });
    localStorage.setItem(key('b'), JSON.stringify({ 'crawl-technical': true, custom: false }));
    useUIStore.getState().hydrateSidebarSections('b');
    expect(useUIStore.getState().collapsedSections).toEqual({ 'crawl-technical': true, custom: false, 'audit-workspace': true });
    useUIStore.getState().hydrateSidebarSections(null);
    expect(useUIStore.getState().collapsedSections).toEqual({});
  });
  it('rejects malformed preference shapes and persists toggles only for a project', () => {
    for (const value of ['null', '[]', '5', 'invalid']) {
      localStorage.setItem(key('a'), value);
      useUIStore.getState().hydrateSidebarSections('a');
      expect(useUIStore.getState().collapsedSections).toEqual({});
    }
    useUIStore.getState().toggleSidebarSection(null, 'section');
    expect(useUIStore.getState().collapsedSections).toEqual({ section: true });
    expect(localStorage.getItem(key('null'))).toBeNull();
    useUIStore.getState().toggleSidebarSection('a', 'section');
    expect(JSON.parse(localStorage.getItem(key('a'))!)).toEqual({ section: false });
    useUIStore.getState().hydrateSidebarSections('b');
    expect(useUIStore.getState().collapsedSections).toEqual({});
  });
});
