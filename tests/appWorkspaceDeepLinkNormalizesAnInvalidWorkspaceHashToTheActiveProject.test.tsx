import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { buildWorkspaceHash } from '@/services/workspaceDeepLink';
import { WORKSPACE_DEEP_LINK_TABS } from '@/services/workspaceDeepLink';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

import i18n from '@/i18n';
import { projects, expectRenderedRoute } from "./fixtures/appWorkspaceDeepLinkContracts";

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
