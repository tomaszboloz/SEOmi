import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { SearchConsoleHub } from '@/components/AgentWorkflows/SearchConsoleHub';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { gscData } from './fixtures/gscTracker';

const projectA = gscData({
  site_url: 'sc-domain:project-a.test',
  queries: [{ query: 'project-a-query', clicks: 20, impressions: 100, ctr: 20, position: 12 }],
});
const projectB = gscData({
  site_url: 'sc-domain:project-b.test',
  queries: [{ query: 'project-b-query', clicks: 30, impressions: 120, ctr: 25, position: 11 }],
});

const setGsc = (projectId: string, data: typeof projectA) => {
  useProjectStore.setState({ activeProjectId: projectId });
  useToolsStore.setState({
    isGscConnected: true,
    gscHydratedProjectId: projectId,
    gscProperty: data.site_url,
    gscData: data,
    gscProperties: [{ siteUrl: data.site_url, permissionLevel: 'siteOwner' }],
    gscFilters: {},
    gscInspectionResult: null,
    gscError: null,
    isGscLoading: false,
  });
};

beforeEach(() => {
  localStorage.clear();
  setGsc('project-a', projectA);
});
afterEach(cleanup);

it('tears down the old project during hydration and reappears for the hydrated project', () => {
  render(<SearchConsoleHub />);
  expect(screen.getByRole('heading', { name: 'GSC opportunities' })).toBeDefined();
  expect(screen.getAllByText('project-a-query').length).toBeGreaterThan(0);

  act(() => {
    useProjectStore.setState({ activeProjectId: 'project-b' });
    useToolsStore.setState({ gscHydratedProjectId: null });
  });
  expect(screen.queryByRole('heading', { name: 'GSC opportunities' })).toBeNull();
  expect(screen.queryByText('project-a-query')).toBeNull();

  act(() => setGsc('project-b', projectB));
  expect(screen.getByRole('heading', { name: 'GSC opportunities' })).toBeDefined();
  expect(screen.getAllByText('project-b-query').length).toBeGreaterThan(0);
  expect(screen.queryByText('project-a-query')).toBeNull();
});

it('tears down the opportunity panel when the selected property no longer matches', () => {
  render(<SearchConsoleHub />);
  expect(screen.getByRole('heading', { name: 'GSC opportunities' })).toBeDefined();

  act(() => useToolsStore.setState({ gscProperty: 'sc-domain:other.test' }));
  expect(screen.queryByRole('heading', { name: 'GSC opportunities' })).toBeNull();
  expect(screen.queryByText('project-a-query')).toBeNull();
});

it('blocks stale data on initial mount until the active project is hydrated', () => {
  act(() => {
    useProjectStore.setState({ activeProjectId: 'project-b' });
    useToolsStore.setState({ gscHydratedProjectId: null });
  });

  render(<SearchConsoleHub />);
  expect(screen.queryByRole('heading', { name: 'GSC opportunities' })).toBeNull();
  expect(screen.queryByText('project-a-query')).toBeNull();

  act(() => setGsc('project-b', projectB));
  expect(screen.getByRole('heading', { name: 'GSC opportunities' })).toBeDefined();
  expect(screen.getAllByText('project-b-query').length).toBeGreaterThan(0);
});
