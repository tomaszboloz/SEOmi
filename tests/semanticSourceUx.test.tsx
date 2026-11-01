import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { SemanticSourceSettings } from '@/components/AI/SemanticSourceSettings';
import { FocusBanners } from '@/components/Domain/crawlResults/focus/FocusBanners';
import { DEFAULT_SEMANTIC_SETTINGS, readSemanticSettings, type SemanticLoad } from '@/services/semanticSource';

const withLoad = (result: SemanticLoad) => vi.fn(async () => result);
beforeEach(() => localStorage.clear());

describe('SemanticSourceSettings', () => {
  it('is off by default and saves edited values', () => {
    render(<SemanticSourceSettings />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText(/Source/), { target: { value: 'hybrid' } });
    fireEvent.change(screen.getByLabelText(/Ollama address/), { target: { value: 'http://10.0.0.5:11434' } });
    fireEvent.change(screen.getByLabelText(/Embedding model/), { target: { value: 'bge-m3' } });
    fireEvent.change(screen.getByLabelText(/Timeout/), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText(/Most pages/), { target: { value: '12,0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Settings saved.')).toBeTruthy();
    expect(readSemanticSettings()).toMatchObject({ enabled: true, provider: 'hybrid', model: 'bge-m3', timeoutMs: 5000, maxEntries: 12 });
    expect(DEFAULT_SEMANTIC_SETTINGS.enabled).toBe(false);
  });

  it('rejects invalid values without writing', () => {
    render(<SemanticSourceSettings />);
    fireEvent.change(screen.getByLabelText(/Timeout/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/Check the values/)).toBeTruthy();
    expect(localStorage.getItem('seomi_semantic_source_v1')).toBeNull();
  });

  it('reports a storage failure', () => {
    render(<SemanticSourceSettings />);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Could not save settings.')).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('tests a working connection', async () => {
    const set = { providerId: 'ollama', model: 'nomic-embed-text', dimensions: 768 };
    const load = vi.fn(async (_input: { settings: { enabled: boolean } }): Promise<SemanticLoad> => ({ status: 'ready', set, rejected: 0, skipped: 0 }));
    render(<SemanticSourceSettings load={load as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test Ollama connection' }));
    await waitFor(() => expect(screen.getByText('Works: nomic-embed-text, 768 dimensions.')).toBeTruthy());
    expect(load.mock.calls[0]?.[0].settings.enabled).toBe(true);
  });

  it('explains an offline provider and an unknown failure', async () => {
    const { unmount } = render(<SemanticSourceSettings load={withLoad({ status: 'fallback', error: { code: 'offline', message: 'x' } }) as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test Ollama connection' }));
    await waitFor(() => expect(screen.getByText('Falling back to TF-IDF: Ollama is not reachable.')).toBeTruthy());
    unmount();
    render(<SemanticSourceSettings load={withLoad({ status: 'off' }) as never} />);
    fireEvent.click(screen.getByRole('button', { name: 'Test Ollama connection' }));
    await waitFor(() => expect(screen.getByText('Falling back to TF-IDF: unknown error.')).toBeTruthy());
  });

  it('uses the real loader by default and falls back when Ollama is unreachable', async () => {
    localStorage.clear();
    render(<SemanticSourceSettings />);
    fireEvent.change(screen.getByLabelText(/Ollama address/), { target: { value: 'http://127.0.0.1:9' } });
    fireEvent.change(screen.getByLabelText(/Timeout/), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Ollama connection' }));
    await waitFor(() => expect(screen.getByText(/Falling back to TF-IDF/)).toBeTruthy(), { timeout: 5000 });
  });
});

describe('FocusBanners semantic note', () => {
  const report = (similaritySource: unknown) => ({
    coreTopic: {}, pageCount: 3, flags: { isLowConfidence: false, isMultiTopic: false, fallbackMode: 'semantic', skippedRenderTimeouts: 0, degraded: false, similaritySource },
  }) as never;

  it('names the model when embeddings contributed', () => {
    render(<FocusBanners report={report({ mode: 'semantic', kind: 'embeddings', model: 'bge-m3' })} />);
    expect(screen.getByText('Semantic similarity active: bge-m3.')).toBeTruthy();
  });

  it('stays quiet for TF-IDF and custom hooks', () => {
    render(<FocusBanners report={report({ mode: 'tfidf-only', kind: 'none' })} />);
    render(<FocusBanners report={report({ mode: 'semantic', kind: 'custom' })} />);
    expect(screen.queryByText(/Semantic similarity active/)).toBeNull();
  });
});
