import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainContent } from '@/components/Layout/MainContent';
import { Sidebar } from '@/components/Layout/Sidebar';

import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

import { workspaceTabs, pageAuditResultTabs, auditFixture, expectRouteContent, routeErrorMessages } from "./fixtures/workspaceRoutesContracts";

describe('workspace route smoke coverage', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useProjectStore.setState({
      projects: [
        {
          id: 'route-smoke-project',
          name: 'Route smoke project',
          rootUrl: 'https://example.com',
          createdAt: '2026-09-24T00:00:00.000Z',
          lastOpenedAt: '2026-09-24T00:00:00.000Z',
        },
      ],
      activeProjectId: 'route-smoke-project',
    });
    useUIStore.setState({
      sidebarCollapsed: false,
      collapsedSections: {},
      activeModal: null,
    });
    useAuditStore.setState({
      activeTab: 'overview',
      currentAudit: null,
      error: null,
      isLoading: false,
      isBatchRunning: false,
    });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

afterEach(() => {
    const routeErrors = consoleError.mock.calls.filter((call: unknown[]) => {
      const message = call[0];
      return typeof message === 'string' && routeErrorMessages.has(message);
    });
    consoleError.mockRestore();
    expect(routeErrors).toEqual([]);
  });

it('mounts every sidebar destination through the real SPA content switch', async () => {
    render(
      <>
        <Sidebar />
        <MainContent />
      </>,
    );

    for (const tab of workspaceTabs) {
      const destination = screen.getAllByRole('button').find(
        (button) => button.getAttribute('data-sidebar-tab') === tab,
      );
      expect(destination, `missing sidebar destination: ${tab}`).toBeTruthy();

      await act(async () => {
        fireEvent.click(destination as HTMLElement);
      });

      await waitFor(() => {
        expect(useAuditStore.getState().activeTab).toBe(tab);
        expectRouteContent(tab);
        expect(screen.queryByRole('alert')).toBeNull();
      }, { timeout: 15_000 });
    }
  }, 60_000);

it('mounts every page-audit result tab without activating the route fallback', async () => {
    useAuditStore.setState({ currentAudit: auditFixture, activeTab: 'overview' });
    render(<MainContent />);

    for (const tab of pageAuditResultTabs) {
      await act(async () => {
        useAuditStore.getState().setActiveTab(tab);
      });

      await waitFor(() => {
        expect(useAuditStore.getState().activeTab).toBe(tab);
        expectRouteContent(tab);
        expect(screen.queryByRole('alert')).toBeNull();
      }, { timeout: 15000 });
    }
  }, 60_000);

it('keeps every action-only workspace destination reachable from the sidebar', async () => {
    render(<Sidebar />);
    const navigation = screen.getByRole('navigation', {
      name: /Application modules|Moduły aplikacji/i,
    });
    const actions = [
      { name: /AI Assistant|AI Optimizer|Optymalizator AI/i, modal: 'ai' as const },
      { name: /AI Connection|Połączenie AI/i, modal: 'subscription' as const },
      { name: /Audit history|Historia audytów/i, modal: 'history' as const },
      { name: /Settings|Ustawienia/i, modal: 'settings' as const },
    ];

    for (const action of actions) {
      fireEvent.click(within(navigation).getByRole('button', { name: action.name }));
      await waitFor(() => expect(useUIStore.getState().activeModal).toBe(action.modal));
      useUIStore.setState({ activeModal: null });
    }

    fireEvent.click(within(navigation).getByRole('button', { name: /Mapa semantyczna|Semantic map/i }));
    expect(useAuditStore.getState().activeTab).toBe('site-audit');
    expect(sessionStorage.getItem('seomi_open_crawl_map_v1')).toBe('1');
  });
});
