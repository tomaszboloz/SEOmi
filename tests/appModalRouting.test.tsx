import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

const stub = vi.hoisted(() => (name: string) => () => <div data-testid={`modal-${name}`} />);

vi.mock('@/components/Settings/SettingsModal', () => ({ SettingsModal: stub('settings') }));
vi.mock('@/components/AI/AIAssistantModal', () => ({ AIAssistantModal: stub('ai') }));
vi.mock('@/components/Auth/SubscriptionModal', () => ({ SubscriptionModal: stub('subscription') }));
vi.mock('@/components/History/HistoryModal', () => ({ HistoryModal: stub('history') }));
vi.mock('@/components/Projects/CreateProjectModal', () => ({ CreateProjectModal: stub('create-project') }));
vi.mock('@/components/Layout/CommandPalette', () => ({ CommandPalette: stub('palette') }));

const project = { id: 'p1', name: 'One', createdAt: 1, updatedAt: 1 };
const open = (modal: 'ai' | 'settings' | 'subscription' | 'history' | 'create-project' | null) => act(() => useUIStore.setState({ activeModal: modal }));

describe('App modal routing', () => {
  beforeEach(() => {
    window.location.hash = '';
    useUIStore.setState({ activeModal: null });
  });

  it.each(['ai', 'settings', 'subscription', 'history', 'create-project'] as const)('renders only the %s modal inside an active project', async (modal) => {
    useProjectStore.setState({ projects: [project] as never, activeProjectId: 'p1' });
    render(<App />);
    expect(await screen.findByTestId('modal-palette')).toBeTruthy();
    expect(screen.queryByTestId(`modal-${modal}`)).toBeNull();
    open(modal);
    expect(await screen.findByTestId(`modal-${modal}`)).toBeTruthy();
    expect(screen.queryAllByTestId(/^modal-(?!palette)/)).toHaveLength(1);
  });

  it('shows the project gate without workspace chrome or palette when no project is active', async () => {
    useProjectStore.setState({ projects: [], activeProjectId: null });
    render(<App />);
    expect(screen.queryByTestId('modal-palette')).toBeNull();
    expect(screen.queryByRole('contentinfo')).toBeNull();
    open('create-project');
    await waitFor(() => expect(screen.getByTestId('modal-create-project')).toBeTruthy());
    open('settings');
    expect(screen.queryByTestId('modal-settings')).toBeNull();
  });
});
