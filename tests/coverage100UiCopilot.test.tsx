import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CopilotPatcherPanel } from '@/components/Results/copilotPatcher';
import { useProjectStore } from '@/stores/projectStore';
import type { PatchTarget } from '@/services/copilotPatcher';

const target: PatchTarget = {
  h1: 'Guide', h2: ['Facts'], heading: 'Answer',
  paragraph: 'The source sentence is factual. Take 5 g daily.', language: 'en',
  pageEntities: ['source'], missingEntities: [], removeFragments: [],
};

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useProjectStore.setState({ activeProjectId: 'owner' });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

describe('coverage 100 copilot UI edges', () => {
  it('reports an unusable passage before calling a provider', () => {
    const generate = vi.fn(async () => 'ignored');
    render(<CopilotPatcherPanel target={{ ...target, paragraph: '  ' }} projectId="owner" index={2} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 3' }));
    expect(screen.getByRole('status').textContent).toContain('passage has no usable source text');
    expect(generate).not.toHaveBeenCalled();
  });

  it('surfaces provider errors and empty usable responses', async () => {
    const error = vi.fn(async () => { throw new Error('offline'); });
    const view = render(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'local', generate: error }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect((await screen.findByRole('alert')).textContent).toContain('AI request failed: offline');
    view.rerender(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'local', generate: vi.fn(async () => 'Take 99 mg now.') }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect((await screen.findByRole('status')).textContent).toContain('AI returned no usable patch');
  });

  it('cancels an in-flight request and ignores its late result', async () => {
    let resolve!: (value: string) => void;
    const generate = vi.fn(() => new Promise<string>((finish) => { resolve = finish; }));
    render(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'local', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Generating...')).toBeNull();
    await act(async () => { resolve('A late response.'); await Promise.resolve(); });
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
  });

  it('rejects a proposal and copies approved HTML through ClipboardItem', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write, writeText } });
    vi.stubGlobal('ClipboardItem', class { constructor(public readonly items: unknown) {} });
    const generate = vi.fn(async () => 'The source sentence is factual. Take 5 g daily. Take 50 g daily.');
    const view = render(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'remote', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    expect(screen.getByRole('note').textContent).toContain('received this page text');
    expect(screen.getAllByRole('status').some((node) => node.textContent?.includes('fact gate'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByText('Proposal rejected.')).toBeTruthy();
    view.rerender(<CopilotPatcherPanel target={target} projectId="owner" index={0} providers={[{ id: 'remote', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    await screen.findByTestId('copilot-patch-proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Approve for copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy approved text' }));
    await act(async () => undefined);
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });
});
