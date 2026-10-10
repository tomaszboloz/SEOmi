import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SidebarAiCard } from '@/components/Layout/sidebar/SidebarAiCard';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import i18n from '@/i18n';

const initialAuth = useAuthStore.getState();
const initialUi = useUIStore.getState();
afterEach(() => { useAuthStore.setState(initialAuth); useUIStore.setState(initialUi); });

describe('direct AI connection card interactions', () => {
  it.each([['claude', 'Claude'], ['openai', 'OpenAI'], ['gemini', 'Gemini']] as const)(
    'shows the active %s provider connection', (provider, name) => {
      useAuthStore.setState({ provider, connectionStatus: { openai: 'connected', claude: 'connected', gemini: 'connected' } });
      render(<SidebarAiCard />);
      expect(screen.getByText(`${name} ${i18n.t('sidebar.connected')}`)).toBeTruthy();
      expect(screen.getByText(i18n.t('sidebar.ready'))).toBeTruthy();
    },
  );
  it('opens connection setup by click/Enter/Space and ignores unrelated keys', () => {
    useUIStore.setState({ activeModal: null });
    useAuthStore.setState({ provider: 'openai', connectionStatus: { openai: 'unconfigured', claude: 'connected', gemini: 'connected' } });
    render(<SidebarAiCard />);
    const button = screen.getByRole('button', { name: i18n.t('sidebar.aiConnection') });
    expect(button.tabIndex).toBe(0);
    expect(screen.getByText(i18n.t('sidebar.connect'))).toBeTruthy();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(useUIStore.getState().activeModal).toBeNull();
    for (const key of ['Enter', ' ']) {
      fireEvent.keyDown(button, { key });
      expect(useUIStore.getState().activeModal).toBe('subscription');
      act(() => useUIStore.getState().closeModal());
    }
    fireEvent.click(button);
    expect(useUIStore.getState().activeModal).toBe('subscription');
  });
});
