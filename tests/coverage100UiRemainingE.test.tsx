import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/Layout/Footer';
import { CopilotPatcherPanel } from '@/components/Results/copilotPatcher';
import type { PatchTarget } from '@/services/copilotPatcher';
import { invokeTauriCommand } from '@/services/tauri';
import { useProjectStore } from '@/stores/projectStore';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { version?: string }) => `${key}${values?.version ? `:${values.version}` : ''}` }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));

const target: PatchTarget = { h1: 'Guide', h2: ['Facts'], heading: 'Answer', paragraph: 'The source sentence is factual. Take 5 g daily.', language: 'en', pageEntities: ['source'], missingEntities: [], removeFragments: [] };
describe('remaining footer and copilot boundaries', () => {
  it('uses restart_required when installed is false and tolerates a missing version', async () => {
    vi.mocked(invokeTauriCommand).mockResolvedValue({ available: true, installed: false, restart_required: true, current_version: '1.0.0' } as never);
    render(<Footer />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'app.footerUpdates' })));
    expect(screen.getByText('legacyUi.settings.updateAvailable')).toBeTruthy();
    expect(screen.getByTitle('legacyUi.settings.restartRequired')).toBeTruthy();
  });

  it('guards proposal decisions after ownership changes and tolerates no clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    useProjectStore.setState({ activeProjectId: 'owner' });
    const generate = vi.fn(async () => 'The source sentence is factual. Take 5 g daily. Take 50 g daily.');
    const view = render(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'remote', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'copilotPatcherUi.generate 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    const actualGetState = useProjectStore.getState;
    vi.spyOn(useProjectStore, 'getState').mockImplementationOnce(() => ({ ...actualGetState(), activeProjectId: 'other' }));
    fireEvent.click(screen.getByRole('button', { name: 'copilotPatcherUi.approve' }));
    expect(screen.getByRole('status').textContent).toContain('copilotPatcherUi.ownership');
    vi.restoreAllMocks();
    useProjectStore.setState({ activeProjectId: 'owner' });
    view.unmount();
    render(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'remote', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'copilotPatcherUi.generate 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    fireEvent.click(screen.getByRole('button', { name: 'copilotPatcherUi.approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'copilotPatcherUi.copy' }));
  });
});
