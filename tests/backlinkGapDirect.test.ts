import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBacklinkGapActions } from '@/stores/tools/backlinks/gap';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { isolatedToolsSlice } from './fixtures/toolsSlice';
import { opportunity } from './fixtures/backlinkSlice';
const original = useSettingsStore.getState();
beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'gap-direct' });
  useSettingsStore.setState({ dataForSeoCredentials: { login: 'fixture', password: 'fixture' } });
});
afterEach(() => { vi.restoreAllMocks(); useSettingsStore.setState(original); });

it('normalizes domain comparison targets and records raw provider scan counts', async () => {
  const getBacklinkGapPage = vi.fn().mockResolvedValue({ items: [opportunity('new.example')], totalCount: 4, rawCount: 3 });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkGapActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkGapPage }) });
  actions.setBacklinkGapCompetitors([' other.com ', '', 'other.com', 'example.com']);
  actions.setBacklinkGapIncludeSubdomains(false);
  store.setState({ backlinkQuery: 'https://example.com/path' });
  await actions.analyzeBacklinkGap();
  expect(getBacklinkGapPage).toHaveBeenCalledWith('example.com', ['other.com'], 0, 100, false);
  expect(store.getState().backlinkGapReport).toMatchObject({ target: 'example.com', competitors: ['other.com'],
    include_subdomains: false, rows_scanned: 3, total_rows: 4, opportunities: [opportunity('new.example')] });
  expect(store.getState().isBacklinkGapLoading).toBe(false);
});

it('keeps missing counts unknown and uses actual returned rows as the scan fallback', async () => {
  const getBacklinkGapPage = vi.fn().mockResolvedValue({ items: [opportunity('new.example')], totalCount: null });
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkGapActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkGapPage }) });
  await actions.analyzeBacklinkGap('example.com', ['other.com'], true);
  expect(store.getState().backlinkGapReport).toMatchObject({ rows_scanned: 1, total_rows: null });
});

it.each([new Error('provider failure'), 'unstructured failure'])('contains comparison rejection %s', async error => {
  const getBacklinkGapPage = vi.fn().mockRejectedValue(error);
  const { store, actions } = isolatedToolsSlice((set, get, services) => createBacklinkGapActions(set, get, services),
    { createDataForSeoClient: vi.fn().mockReturnValue({ getBacklinkGapPage }) });
  await actions.analyzeBacklinkGap('example.com', ['other.com']);
  expect(store.getState().backlinkGapReport).toBeNull();
  expect(store.getState().backlinkGapError).toBeTruthy();
  expect(store.getState().isBacklinkGapLoading).toBe(false);
});
