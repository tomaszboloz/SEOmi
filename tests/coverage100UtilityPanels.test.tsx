import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';
import { CopilotPatcherPanel, pageHasPatchContext, patchTargetForPassage } from '@/components/Results/copilotPatcher';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { PatchTarget } from '@/services/copilotPatcher';

const target: PatchTarget = { h1: 'Guide', h2: ['Facts'], heading: 'Answer', paragraph: 'The source sentence is factual.', language: 'en', pageEntities: ['source'], missingEntities: [], removeFragments: [] };

beforeEach(async () => {
  await i18n.changeLanguage('en');
  useProjectStore.setState({ activeProjectId: 'panel-p1' });
  useToolsStore.setState({ savedKeywords: [], crawlRuns: [], addSavedKeyword: () => undefined } as never);
});

describe('coverage 100 panel and target edges', () => {
  it('executes the guarded empty import and saves then rejects a duplicate', () => {
    const add = vi.fn();
    useToolsStore.setState({ savedKeywords: [], crawlRuns: [], addSavedKeyword: add } as never);
    render(<FreeSuggestionsPanel query="solar" geo="PL" language="pl" />);
    const importButton = screen.getByRole('button', { name: 'Import' });
    Object.defineProperty(importButton, 'disabled', { configurable: true, value: false });
    act(() => fireEvent.click(importButton));
    act(() => fireEvent.change(screen.getByLabelText('Suggestions payload'), { target: { value: '["solar"]' } }));
    act(() => fireEvent.click(importButton));
    const save = screen.getByRole('button', { name: 'Save' });
    act(() => fireEvent.click(save));
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'solar' }));
    act(() => useToolsStore.setState({ savedKeywords: [{ keyword: 'solar' }] } as never));
    Object.defineProperty(save, 'disabled', { configurable: true, value: false });
    act(() => fireEvent.click(save));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('builds patch context from semantic sections and language fallbacks', () => {
    const page = { heading_texts: { h1: ['Guide'] }, rag_sections: [{ heading: 'Facts', level: 2 }], semantic_terms: ['solar'], semantic_language: null, document_language: 'pl' };
    const passage = { heading: '', text: 'A paragraph', url: 'https://example.test/' };
    expect(patchTargetForPassage(page as never, passage as never)).toMatchObject({ h1: 'Guide', h2: ['Facts'], heading: null, language: 'pl' });
    expect(patchTargetForPassage(undefined, passage as never).language).toBe('');
    expect(pageHasPatchContext(page as never)).toBe(true);
    expect(pageHasPatchContext(undefined)).toBe(false);
  });

  it('reports ownership and missing providers without calling native AI', async () => {
    const mismatch = render(<CopilotPatcherPanel target={target} projectId="other" index={0} providers={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect(screen.getByRole('status').textContent).toContain('project is no longer active');
    mismatch.unmount();
    render(<CopilotPatcherPanel target={target} projectId="panel-p1" index={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest patch 1' }));
    expect((await screen.findByRole('status')).textContent).toContain('Connect an AI provider');
  });
});
