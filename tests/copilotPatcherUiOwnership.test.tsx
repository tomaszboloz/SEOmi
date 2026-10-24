import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CopilotPatcherPanel } from '@/components/Results/copilotPatcher';
import { useProjectStore } from '@/stores/projectStore';
import type { PatchTarget } from '@/services/copilotPatcher';

const target: PatchTarget = {
  h1: 'Guide', h2: ['Values'], heading: 'Question', paragraph: 'The answer is clear.', language: 'en',
  pageEntities: ['answer'], missingEntities: [], removeFragments: [],
};
const activate = (activeProjectId: string | null): void => { useProjectStore.setState({ activeProjectId }); };

beforeEach(async () => { await i18n.changeLanguage('en'); activate(null); });

describe('copilot patcher project ownership', () => {
  it('clears a proposal after switching projects and guards a stale copy click', async () => {
    activate('project-a');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const generate = vi.fn(async () => 'The answer is now clearer.');
    render(<CopilotPatcherPanel target={target} projectId="project-a" index={0} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Approve for copy' }));
    const staleCopy = screen.getByRole('button', { name: 'Copy approved text' });
    act(() => { activate('project-b'); fireEvent.click(staleCopy); });
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('invalidates a provider result when the active project changes mid-request', async () => {
    activate('project-a');
    let resolve!: (text: string) => void;
    const generate = vi.fn(() => new Promise<string>(finish => { resolve = finish; }));
    render(<CopilotPatcherPanel target={target} projectId="project-a" index={0} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(screen.getByText('Generating...')).toBeTruthy();
    act(() => activate('project-b'));
    await act(async () => { resolve('The answer is now clearer.'); await Promise.resolve(); });
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
    expect(screen.queryByText('Generating...')).toBeNull();
  });

  it('clears a proposal when prompt context changes even if the paragraph is unchanged', async () => {
    activate('project-a');
    const generate = vi.fn(async () => 'The answer is now clearer.');
    const { rerender } = render(<CopilotPatcherPanel target={target} projectId="project-a" index={0} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    rerender(<CopilotPatcherPanel target={{ ...target, pageEntities: ['different entity'] }} projectId="project-a" index={0} providers={[{ id: 'local', generate }]} />);
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
  });

  it('does not generate without an explicit active project owner', () => {
    const generate = vi.fn(async () => 'The answer is now clearer.');
    render(<CopilotPatcherPanel target={target} index={0} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(generate).not.toHaveBeenCalled();
    expect(screen.getByText('The project is no longer active; this request was stopped.')).toBeTruthy();
  });
});
