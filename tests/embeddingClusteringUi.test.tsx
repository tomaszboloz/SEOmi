import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { KeywordClustering } from '@/components/Keywords/KeywordClustering';
import { EmbeddingClusteringPanel } from '@/components/Keywords/embeddingClustering/EmbeddingClusteringPanel';
import { loadEmbeddingSession } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';

const keywords = ['robots.txt disallow rules', 'jak zablokować stronę w robots.txt', 'hreflang x-default', 'hreflang dla wersji językowych'];
beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  useProjectStore.setState({ activeProjectId: 'p1' });
  useToolsStore.setState({ keywordResults: [], savedKeywords: [] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('embedding clustering panel', () => {
  it('groups phrases offline, shows groups and persists the result per project', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<EmbeddingClusteringPanel projectId="p1" keywords={keywords} />);
    expect(screen.getByText(i18n.t('embeddingClusteringUi.free', { count: 4 }))).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('embeddingClusteringUi.run') })); });
    const results = await screen.findByRole('region', { name: i18n.t('embeddingClusteringUi.resultTitle') });
    expect(within(results).getAllByRole('article')).toHaveLength(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(loadEmbeddingSession('p1').result?.clusters).toHaveLength(2);
    expect(loadEmbeddingSession('p2').result).toBeNull();
  });

  it('shows Ollama fields only for Ollama-backed models and resets the threshold', () => {
    render(<EmbeddingClusteringPanel projectId="p1" keywords={keywords} />);
    expect(screen.queryByLabelText(i18n.t('embeddingClusteringUi.ollamaModel'))).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('embeddingClusteringUi.provider') }), { target: { value: 'hybrid' } });
    expect(screen.getByLabelText(i18n.t('embeddingClusteringUi.ollamaModel'))).toBeTruthy();
    expect(screen.getByText(i18n.t('embeddingClusteringUi.ollamaHint'))).toBeTruthy();
    expect(screen.getByText(i18n.t('embeddingClusteringUi.threshold', { value: '0.35' }))).toBeTruthy();
    expect(loadEmbeddingSession('p1').settings).toMatchObject({ provider: 'hybrid', threshold: null });
  });

  it('reports Ollama failures and disables running with too few phrases', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const view = render(<EmbeddingClusteringPanel projectId="p1" keywords={keywords} />);
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('embeddingClusteringUi.provider') }), { target: { value: 'ollama' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('embeddingClusteringUi.run') })); });
    expect((await screen.findByRole('alert')).textContent).toMatch(/ollama serve/);
    view.rerender(<EmbeddingClusteringPanel projectId="p1" keywords={['one']} />);
    expect((screen.getByRole('button', { name: i18n.t('embeddingClusteringUi.run') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('ignores corrupted stored sessions', () => {
    localStorage.setItem('seomi_project_p1_embedding_clustering_v1', JSON.stringify({ provider: 'gpt', threshold: 5, result: { method: 'x' } }));
    expect(loadEmbeddingSession('p1')).toMatchObject({ settings: { provider: 'local', threshold: null }, result: null });
  });
});

describe('clustering method switch', () => {
  it('defaults to free embeddings and remembers the chosen method per project', async () => {
    render(<KeywordClustering />);
    const embeddings = screen.getByRole('radio', { name: new RegExp(i18n.t('embeddingClusteringUi.methods.embeddings.title').replace(/[()]/g, '\\$&')) });
    expect(embeddings.getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(i18n.t('keywordClusteringUi.costNotice'))).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(i18n.t('embeddingClusteringUi.methods.serp.title').replace(/[()]/g, '\\$&')) }));
    await waitFor(() => expect(screen.getByText(i18n.t('keywordClusteringUi.costNotice'))).toBeTruthy());
    expect(localStorage.getItem('seomi_project_p1_keyword_clustering_method_v1')).toBe('serp');
  });

  it('keeps the SERP method for a project that already has a SERP result', () => {
    localStorage.setItem('seomi_keyword_clustering_p1', JSON.stringify({ input: 'a\nb', country: 'PL', language: 'pl', minSharedUrls: 3,
      result: { clusters: [], unclusteredKeywords: ['a', 'b'], snapshots: [], minSharedUrls: 3, analyzedAt: '2026-10-01T00:00:00.000Z' } }));
    render(<KeywordClustering />);
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain(i18n.t('embeddingClusteringUi.methods.serp.title'));
  });
});
