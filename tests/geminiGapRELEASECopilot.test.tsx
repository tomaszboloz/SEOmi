import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CopilotPatcherPanel } from '@/components/Results/copilotPatcher';
import type { PatchTarget } from '@/services/copilotPatcher';
import { useProjectStore } from '@/stores/projectStore';
import { useAuthStore } from '@/stores/authStore';

const target: PatchTarget = {
  h1: 'Blood glucose guide', h2: ['Normal values'], heading: 'What is normal?',
  paragraph: 'Blood glucose is 90 mg/dl.', language: 'en', pageEntities: ['Blood glucose'], missingEntities: [], removeFragments: [],
};

describe('RELEASE CopilotPatcherPanel branches lines 71 and 79', () => {
  const initialProjectState = useProjectStore.getState();
  const initialAuthState = useAuthStore.getState();

  beforeEach(async () => {
    await i18n.changeLanguage('en');
    useProjectStore.setState({ activeProjectId: 'ui-project' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useProjectStore.setState(initialProjectState, true);
    useAuthStore.setState(initialAuthState, true);
  });

  it('covers line 71 when providers is undefined (selectedConnected true vs false)', async () => {
    // Branch 1: providers undefined and selectedConnected is false -> configured is []
    useAuthStore.setState({
      provider: 'openai',
      connectionStatus: { ...useAuthStore.getState().connectionStatus, openai: 'unconfigured' },
    });
    const { rerender } = render(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(await screen.findByText('Connect an AI provider before requesting a patch.')).toBeTruthy();

    // Branch 2: providers undefined and selectedConnected is true -> configured is [{ id, local, generate }]
    useAuthStore.setState({
      provider: 'openai',
      connectionStatus: { ...useAuthStore.getState().connectionStatus, openai: 'connected' },
      connectionMethod: { ...useAuthStore.getState().connectionMethod, openai: 'local_cli' },
    });
    rerender(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(await screen.findByRole('button', { name: 'Suggest patch 1' })).toBeTruthy();
  });

  it('covers proposal generation and line 79 provider-error message branch', async () => {
    // Positive branch: provider successfully generates patch proposal
    const successfulProvider = {
      id: 'mock-ok',
      generate: vi.fn(async () => 'Blood glucose is normal at 90 mg/dl.'),
    };
    const { rerender } = render(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} providers={[successfulProvider]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(await screen.findByTestId('copilot-patch-proposal')).toBeTruthy();
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();

    // Negative branch line 79: provider throws Error -> result.reason === 'provider-error' -> shows error alert
    const failingProvider = {
      id: 'mock-fail',
      generate: vi.fn(async () => { throw new Error('Simulated upstream model crash'); }),
    };
    rerender(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} providers={[failingProvider]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Simulated upstream model crash');
  });

  it('exercises real user cancellation flow while generation is in flight', async () => {
    let unblock!: () => void;
    const pendingPromise = new Promise<string>((resolve) => { unblock = () => resolve('Late patch result'); });
    const slowProvider = { id: 'mock-slow', generate: vi.fn(() => pendingPromise) };

    render(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} providers={[slowProvider]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));

    // Busy state displays cancel button
    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeTruthy();
    fireEvent.click(cancelButton);

    // Resolving after cancel does not update state to proposal
    await act(async () => { unblock(); });
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
  });
});
