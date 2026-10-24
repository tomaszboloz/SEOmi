import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import PrePublishWorkspace from '@/components/Charts/prePublish/PrePublishWorkspace';
import { createProvider } from '@/services/embeddings/registry';
import { createCrawlPageFixture } from './fixtures/crawl';
import { draftText, mockProvider, mountRun } from './fixtures/prePublishMount';

vi.mock('@/services/embeddings/registry', async (original) => ({
  ...await original<typeof import('@/services/embeddings/registry')>(), createProvider: vi.fn(),
}));
const runButton = () => screen.getByRole('button', { name: 'Check draft' }) as HTMLButtonElement;
const fillDraft = () => fireEvent.change(screen.getByLabelText('Unpublished draft text'), { target: { value: draftText } });
beforeEach(async () => {
  localStorage.clear(); vi.clearAllMocks(); mockProvider();
  await i18n.changeLanguage('en');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network')));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('mounted pre-publish UI', () => {
  it('shows no crawl and disables checks without project-owned crawl evidence', () => {
    render(<PrePublishWorkspace projectId="mount-project" runs={[mountRun('other')]} />);
    expect(screen.getByText(/No completed crawl for the active project/)).toBeTruthy();
    fillDraft();
    expect(runButton().disabled).toBe(true);
    expect(createProvider).not.toHaveBeenCalled();
  });
  it('validates text and optional URL before embedding', () => {
    render(<PrePublishWorkspace projectId="mount-project" runs={[mountRun()]} />);
    expect(runButton().disabled).toBe(true);
    fillDraft();
    expect(runButton().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Draft URL (optional)'), { target: { value: 'bad-url' } });
    expect(runButton().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('valid HTTP or HTTPS');
    fireEvent.change(screen.getByLabelText('Draft URL (optional)'), { target: { value: 'https://example.test/new' } });
    expect(runButton().disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(screen.getByLabelText('Unpublished draft text'), { target: { value: ' ' } });
    fireEvent.click(runButton());
    expect(createProvider).not.toHaveBeenCalled();
  });
  it('renders the existing report card using project embedding settings without saving anything', async () => {
    localStorage.setItem('seomi_project_mount-project_embedding_clustering_v1', JSON.stringify({
      provider: 'hybrid', ollamaModel: 'my-embedding-model', threshold: null, labelModel: '', result: null,
    }));
    const before = { ...localStorage };
    render(<PrePublishWorkspace projectId="mount-project" runs={[mountRun()]} />);
    fillDraft(); fireEvent.click(runButton());
    await screen.findByRole('button', { name: 'Copy report' });
    expect(screen.getByText('Do not publish yet: the draft duplicates an existing page.')).toBeTruthy();
    expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'hybrid', ollamaModel: 'my-embedding-model' }));
    expect({ ...localStorage }).toEqual(before);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('shows no Core Topic and the existing insufficient card without embedding', async () => {
    const run = mountRun();
    run.result.pages = [createCrawlPageFixture()];
    render(<PrePublishWorkspace projectId="mount-project" runs={[run]} />);
    expect(screen.getByText(/No Core Topic yet. The check/)).toBeTruthy();
    fillDraft(); fireEvent.click(runButton());
    await screen.findByText('Not enough data to judge this draft.');
    expect(screen.getByText('No Core Topic yet.')).toBeTruthy();
    expect(createProvider).not.toHaveBeenCalled();
  });
  it('shows insufficient corpus and model reasons via the existing card', async () => {
    const run = mountRun();
    run.result.pages = run.result.pages.slice(0, 2);
    const view = render(<PrePublishWorkspace projectId="mount-project" runs={[run]} />);
    fillDraft(); fireEvent.click(runButton());
    await screen.findByText('Fewer than 3 scored pages on the site.');
    view.rerender(<PrePublishWorkspace projectId="mount-project" runs={[mountRun()]} />);
    mockProvider(vi.fn().mockResolvedValue([]));
    fireEvent.click(runButton());
    await screen.findByText('Embeddings come from different models.');
    expect(screen.getByText('Not enough data to judge this draft.')).toBeTruthy();
  });
  it('reports unreachable providers without manufacturing a verdict or falling back', async () => {
    mockProvider(vi.fn().mockRejectedValue(new Error('offline')));
    render(<PrePublishWorkspace projectId="mount-project" runs={[mountRun()]} />);
    fillDraft(); fireEvent.click(runButton());
    await waitFor(() => expect(screen.getByText(/selected embedding provider could not return vectors/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Copy report' })).toBeNull();
    expect(createProvider).toHaveBeenCalledOnce();
    expect(runButton().disabled).toBe(false);
  });
});
