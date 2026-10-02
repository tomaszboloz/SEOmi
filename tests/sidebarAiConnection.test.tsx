import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from '@/components/Layout/Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import i18n from '@/i18n';

describe('sidebar AI connection status', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [{ id: 'ai-status', name: 'AI status project', rootUrl: 'https://example.com', createdAt: '2026-10-02T00:00:00.000Z', lastOpenedAt: '2026-10-02T00:00:00.000Z' }],
      activeProjectId: 'ai-status',
    });
    useUIStore.setState({ sidebarCollapsed: false, collapsedSections: {}, activeModal: null });
    useAuthStore.setState({
      provider: 'claude',
      connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
    });
  });

  it('switches to ready when the connection is established after the first render', () => {
    render(<Sidebar />);
    expect(screen.getByText(i18n.t('sidebar.aiConnectionPrompt'))).toBeTruthy();

    // CLI detection finishes asynchronously, after the sidebar is on screen.
    act(() => {
      useAuthStore.setState({ connectionStatus: { openai: 'unconfigured', claude: 'connected', gemini: 'unconfigured' } });
    });

    expect(screen.getByText(i18n.t('sidebar.aiConnectionReady'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('sidebar.aiConnectionPrompt'))).toBeNull();
  });
});
