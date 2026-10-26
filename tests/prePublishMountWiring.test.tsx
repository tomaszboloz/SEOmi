import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { readTopicalWorkspacePreferences } from '@/components/Charts/semanticTopical/workspaceHelpers';
import { buildSemanticMap } from '@/services/semanticMap';
import { createProvider } from '@/services/embeddings/registry';
import { draftText, mockProvider, mountRun } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
beforeEach(async () => { localStorage.clear(); vi.clearAllMocks(); mockProvider(); await i18n.changeLanguage('en'); });
afterEach(cleanup);
it('mounts only on the lazy planning tab and checks the newest crawl, not the displayed one', async () => {
  const old = mountRun('mount-project', 'old', '2026-10-01');
  old.result.pages[0].semantic_excerpts = ['Older crawl evidence'];
  const latest = mountRun();
  latest.result.pages[0].semantic_excerpts = ['Newest crawl evidence'];
  render(<SemanticTopicalWorkspace projectId="mount-project" pages={old.result.pages}
    graph={buildSemanticMap(old.result.pages, old.startUrl)} runId={old.id} runs={[old, latest]} />);
  expect(screen.queryByLabelText('Unpublished draft text')).toBeNull();
  expect(createProvider).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('tab', { name: 'Pre-publish check' }));
  const text = await screen.findByLabelText('Unpublished draft text');
  expect(readTopicalWorkspacePreferences('mount-project').view).toBe('prepublish');
  fireEvent.change(text, { target: { value: draftText } });
  fireEvent.click(screen.getByRole('button', { name: 'Check draft' }));
  await screen.findByRole('button', { name: 'Copy report' });
  const corpus = vi.mocked(createProvider).mock.calls[0][0].corpus!.join('\n');
  expect(corpus).toContain('Newest crawl evidence');
  expect(corpus).not.toContain('Older crawl evidence');
});
it('unmounts the draft when switching away and does not leak it into another project', async () => {
  const run = mountRun();
  const graph = buildSemanticMap(run.result.pages, run.startUrl);
  const view = render(<SemanticTopicalWorkspace projectId="mount-project" pages={run.result.pages}
    graph={graph} runId={run.id} runs={[run]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Pre-publish check' }));
  fireEvent.change(await screen.findByLabelText('Unpublished draft text'), { target: { value: draftText } });
  view.rerender(<SemanticTopicalWorkspace projectId="other" pages={run.result.pages}
    graph={graph} runId={run.id} runs={[run]} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Pre-publish check' }));
  expect((await screen.findByLabelText('Unpublished draft text') as HTMLTextAreaElement).value).toBe('');
  expect(screen.getByText(/No completed crawl for the active project/)).toBeTruthy();
});
