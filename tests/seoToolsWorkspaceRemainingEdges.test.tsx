import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { SeoToolsWorkspace } from '@/components/SeoTools/SeoToolsWorkspace';
import { useProjectStore } from '@/stores/projectStore';
import { readStorage, writeStorage } from '@/services/storage';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return { ...actual, useTranslation: () => ({
    t: (key: string) => key === 'seoTools.tabs.competitor-keywords' ? '' : key,
  }) };
});
vi.mock('@/services/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/storage')>();
  return { ...actual, readStorage: vi.fn(), writeStorage: vi.fn() };
});
vi.mock('@/components/Domain/BacklinkChecker', () => ({ BacklinkChecker: () => null }));
vi.mock('@/components/Domain/DomainOverview', () => ({ DomainOverview: () => null }));
vi.mock('@/components/Keywords/KeywordResearch', () => ({ KeywordResearch: () => null }));
vi.mock('@/components/SeoTools/workspace/SeoToolsPanelHeader', () => ({ SeoToolsPanelHeader: () => null }));
vi.mock('@/components/SeoTools/workspace/DomainAgePanel', () => ({ DomainAgePanel: () => null }));
vi.mock('@/components/SeoTools/workspace/CompetitorKeywordsPanel', () => ({ CompetitorKeywordsPanel: () => null }));
vi.mock('@/components/SeoTools/workspace/TrafficCheckerPanel', () => ({ TrafficCheckerPanel: () => null }));
vi.mock('@/components/SeoTools/workspace/SerpSimulatorPanel', () => ({ SerpSimulatorPanel: () => null }));

const originalProject = useProjectStore.getState();

describe('SEO tools workspace edge branches', () => {
  beforeEach(() => {
    vi.mocked(readStorage).mockReset();
    vi.mocked(writeStorage).mockReset();
    useProjectStore.setState({ projects: [], activeProjectId: null });
  });
  afterEach(() => {
    cleanup();
    useProjectStore.setState(originalProject, true);
  });

  it('skips project storage, keeps the fallback label and still switches tabs', () => {
    render(<SeoToolsWorkspace />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    fireEvent.click(tabs[1]);
    expect(readStorage).not.toHaveBeenCalled();
    expect(writeStorage).not.toHaveBeenCalled();
    expect(screen.getByRole('tabpanel').getAttribute('aria-label')).toBe('seoTools.tabs.competitor-analysis');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });

  it('restores a valid stored tool for an active project', async () => {
    useProjectStore.setState({ activeProjectId: 'project-one' });
    vi.mocked(readStorage).mockReturnValue('domain-age');
    render(<SeoToolsWorkspace />);
    await waitFor(() => expect(screen.getAllByRole('tab')[4].getAttribute('aria-selected')).toBe('true'));
    expect(readStorage).toHaveBeenCalledWith('seomi_project_project-one_seo_tools_tab_v1');
  });
});
