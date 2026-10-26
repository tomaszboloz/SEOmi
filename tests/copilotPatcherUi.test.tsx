import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CopilotPatcherPanel, pageHasPatchContext, patchTargetForPassage } from '@/components/Results/copilotPatcher';
import type { PatchTarget } from '@/services/copilotPatcher';
import { useProjectStore } from '@/stores/projectStore';
import { aioPage, WEAK } from './aioFixtures';

const target: PatchTarget = {
  h1: 'Blood glucose guide', h2: ['Normal values'], heading: 'What is a normal blood sugar?',
  paragraph: 'It varies. Blood glucose is measured in mg/dl.', language: 'en', pageEntities: ['Blood glucose'], missingEntities: [], removeFragments: [],
};

beforeEach(async () => { await i18n.changeLanguage('en'); useProjectStore.setState({ activeProjectId: 'ui-project' }); });

describe('contextual copilot patcher UI', () => {
  it('maps real page context and keeps missing context empty', () => {
    const page = aioPage('https://a.test/page', [WEAK], { heading_texts: { h1: ['Blood glucose guide'], h2: ['Normal values'], h3: [] }, semantic_terms: ['blood glucose'] });
    const mapped = patchTargetForPassage(page, { ...WEAK, url: page.url, text: WEAK.paragraphs.join(' '), tokens: 12, windowIndex: 0, score: 20, selfContainment: 0, answerFirst: 0, triples: 0, issues: [] });
    expect(mapped.h1).toBe('Blood glucose guide');
    expect(mapped.h2).toEqual(['Normal values']);
    expect(mapped.missingEntities).toEqual([]);
    expect(pageHasPatchContext(page)).toBe(true);
    expect(pageHasPatchContext(undefined)).toBe(false);
  });

  it('shows a before/after proposal and only copies after approval', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const generate = vi.fn(async () => 'Blood glucose is variable. Blood glucose is measured in mg/dl.');
    render(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} providers={[{ id: 'ollama', generate }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(await screen.findByTestId('copilot-patch-proposal')).toBeTruthy();
    expect(screen.getByText('Before')).toBeTruthy();
    expect(screen.getByText('After')).toBeTruthy();
    expect(screen.getByText('Pending review; nothing has changed.')).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Approve for copy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy approved text' }));
    await act(async () => undefined);
    expect(writeText).toHaveBeenCalledWith('Blood glucose is variable. Blood glucose is measured in mg/dl.');
  });

  it('reports a missing provider without fabricating a result', async () => {
    render(<CopilotPatcherPanel target={target} projectId="ui-project" index={0} providers={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(await screen.findByText('Connect an AI provider before requesting a patch.')).toBeTruthy();
    expect(screen.queryByTestId('copilot-patch-proposal')).toBeNull();
  });
});
