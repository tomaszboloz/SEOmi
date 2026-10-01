import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { buildWorkspaceHash } from '@/services/workspaceDeepLink';
import { WORKSPACE_DEEP_LINK_TABS } from '@/services/workspaceDeepLink';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { WORKSPACE_NAVIGATION } from '@/components/Layout/navigation';
import i18n from '@/i18n';

const projects = [
  {
    id: 'project-a',
    name: 'Pierwszy projekt',
    rootUrl: 'https://first.example',
    createdAt: '2026-09-24T00:00:00.000Z',
    lastOpenedAt: '2026-09-24T00:00:00.000Z',
  },
  {
    id: 'project-b',
    name: 'Drugi projekt',
    rootUrl: 'https://second.example',
    createdAt: '2026-09-24T00:00:00.000Z',
    lastOpenedAt: '2026-09-24T00:00:00.000Z',
  },
] as const;

const expectRenderedRoute = (route: string) => {
  const text = screen.getByRole('main').textContent?.trim() ?? '';
  expect(text, `route ${route} remained on the lazy loading fallback`).not.toMatch(
    /^(?:Loading view…|Ładowanie widoku…|Loading view\.\.\.|Ładowanie widoku\.\.\.)$/,
  );
  expect(text.length).toBeGreaterThan(30);
};

describe('App workspace deep-link integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = buildWorkspaceHash({ projectId: 'project-b', tab: 'keyword-research' });
    useProjectStore.setState({ projects: [...projects], activeProjectId: 'project-a' });
    useAuditStore.setState({
      activeTab: 'overview',
      currentAudit: null,
      error: null,
      isLoading: false,
      isBatchRunning: false,
    });
    useUIStore.setState({ activeModal: null, sidebarCollapsed: false, collapsedSections: {} });
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('opens the linked project and tab, then keeps a manual project switch authoritative', async () => {
    render(<App />);

    await waitFor(() => {
      expect(useProjectStore.getState().activeProjectId).toBe('project-b');
      expect(useAuditStore.getState().activeTab).toBe('keyword-research');
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-b', tab: 'keyword-research' }),
      );
    });

    fireEvent.change(screen.getByRole('combobox', { name: /active project/i }), {
      target: { value: 'project-a' },
    });

    await waitFor(() => {
      expect(useProjectStore.getState().activeProjectId).toBe('project-a');
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' }),
      );
    });

    const keywordDestination = screen
      .getAllByRole('button', { name: /keyword research/i })
      .find((button) => button.getAttribute('data-sidebar-tab') === 'keyword-research');
    expect(keywordDestination).toBeTruthy();
    fireEvent.click(keywordDestination as HTMLElement);

    await waitFor(() => {
      expect(useAuditStore.getState().activeTab).toBe('keyword-research');
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-a', tab: 'keyword-research' }),
      );
    });
  });

  it('mounts every sidebar module through the full App shell without a route fallback', async () => {
    window.location.hash = buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' });
    useProjectStore.setState({ activeProjectId: 'project-a' });
    useAuditStore.setState({ activeTab: 'overview' });
    render(<App />);

    const tabs = Array.from(
      new Set(
        WORKSPACE_NAVIGATION.flatMap((section) =>
          section.items.flatMap((item) => (item.tab ? [item.tab] : [])),
        ),
      ),
    );

    for (const tab of tabs) {
      const destination = screen
        .getAllByRole('button')
        .find((button) => button.getAttribute('data-sidebar-tab') === tab);
      expect(destination, `missing App destination: ${tab}`).toBeTruthy();

      await act(async () => {
        fireEvent.click(destination as HTMLElement);
      });

      await waitFor(() => {
        expect(useAuditStore.getState().activeTab).toBe(tab);
        expectRenderedRoute(tab);
        expect(screen.queryByRole('alert')).toBeNull();
      }, { timeout: 15_000 });
    }
  }, 60_000);

  it('routes the semantic-map action into the crawler without leaving a dead tab', async () => {
    window.location.hash = buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' });
    useProjectStore.setState({ activeProjectId: 'project-a' });
    useAuditStore.setState({ activeTab: 'overview' });
    const openMapEvent = vi.fn();
    window.addEventListener('seomi:open-crawl-map', openMapEvent);

    try {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /semantic map|mapa semantyczna/i }));

      await waitFor(() => {
        expect(useAuditStore.getState().activeTab).toBe('site-audit');
        expect(window.location.hash).toBe(
          buildWorkspaceHash({ projectId: 'project-a', tab: 'site-audit' }),
        );
      });
      expect(openMapEvent).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(i18n.t('siteAudit.mapRequiresCrawl'))).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      window.removeEventListener('seomi:open-crawl-map', openMapEvent);
    }
  });

  it('keeps repeated manual project switches authoritative over internally written hashes', async () => {
    render(<App />);
    await waitFor(() => {
      expect(useProjectStore.getState().activeProjectId).toBe('project-b');
      expect(useAuditStore.getState().activeTab).toBe('keyword-research');
    });
    for (const [projectId, tab] of [['project-a', 'overview'], ['project-b', 'keyword-research'], ['project-a', 'overview']] as const) {
      fireEvent.change(screen.getByRole('combobox', { name: /active project/i }), {
        target: { value: projectId },
      });
      await waitFor(() => {
        expect(useProjectStore.getState().activeProjectId).toBe(projectId);
        expect(useAuditStore.getState().activeTab).toBe(tab);
        expect(window.location.hash).toBe(buildWorkspaceHash({ projectId, tab }));
      });
    }
  });

  it('normalizes an invalid workspace hash to the active project route', async () => {
    window.location.hash = '#workspace?project=project-a&tab=not-a-route';
    useProjectStore.setState({ activeProjectId: 'project-a' });
    useAuditStore.setState({ activeTab: 'search-console' });

    render(<App />);

    await waitFor(() => {
      expect(window.location.hash).toBe(
        buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' }),
      );
      expect(useAuditStore.getState().activeTab).toBe('overview');
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('restores every valid workspace tab from a project deep link', async () => {
    window.location.hash = buildWorkspaceHash({ projectId: 'project-a', tab: 'overview' });
    useProjectStore.setState({ activeProjectId: 'project-a' });
    useAuditStore.setState({ activeTab: 'overview' });
    render(<App />);

    for (const tab of WORKSPACE_DEEP_LINK_TABS) {
      const hash = buildWorkspaceHash({ projectId: 'project-a', tab });
      await act(async () => {
        window.location.hash = hash;
      });

      await waitFor(() => {
        expect(useAuditStore.getState().activeTab).toBe(tab);
        expect(window.location.hash).toBe(hash);
        expectRenderedRoute(tab);
        expect(screen.queryByRole('alert')).toBeNull();
      }, { timeout: 10_000 });
    }
  }, 20_000);
});
