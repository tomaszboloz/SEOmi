import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { EmbeddingClusteringPanel } from '@/components/Keywords/embeddingClustering/EmbeddingClusteringPanel';
import { useEmbeddingClustering } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import type { EmbeddingSettings } from '@/components/Keywords/embeddingClustering/useEmbeddingClustering';
import type { EmbeddingClusteringResult } from '@/services/embeddingClustering';

vi.mock('@/components/Keywords/embeddingClustering/useEmbeddingClustering', () => ({ useEmbeddingClustering: vi.fn() }));
vi.mock('@/components/Keywords/embeddingClustering/EmbeddingClusterResults', () => ({
  EmbeddingClusterResults: ({ result }: { result: EmbeddingClusteringResult }) => <div data-testid="embedding-result">result:{result.model}</div>,
}));

type State = ReturnType<typeof useEmbeddingClustering>;
const settings = (overrides: Partial<EmbeddingSettings> = {}): EmbeddingSettings => ({ provider: 'local', threshold: null, ollamaModel: 'nomic-embed-text', labelModel: '', ...overrides });
const result: EmbeddingClusteringResult = { method: 'embeddings', provider: 'local', model: 'local-hash', threshold: 0.35, clusters: [], unclusteredKeywords: ['one'], analyzedAt: '2026-10-05T00:00:00Z' };
const baseState = { settings: settings(), result: null, isRunning: false, error: null, updateSettings: vi.fn(), run: vi.fn().mockResolvedValue(undefined) } as State;
const configure = (overrides: Partial<State> = {}) => vi.mocked(useEmbeddingClustering).mockReturnValue({ ...baseState, ...overrides });
const label = (key: string, values?: Record<string, unknown>) => i18n.t(`embeddingClusteringUi.${key}`, values);

describe('EmbeddingClusteringPanel direct contracts', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); vi.clearAllMocks(); configure(); });

  it('forwards provider, threshold, model settings and run, and renders a result', () => {
    const updateSettings = vi.fn();
    const run = vi.fn().mockResolvedValue(undefined);
    configure({ settings: settings({ provider: 'ollama' }), updateSettings, run, result });
    render(<EmbeddingClusteringPanel projectId="p1" keywords={['alpha', 'beta']} />);
    fireEvent.change(screen.getByRole('combobox', { name: label('provider') }), { target: { value: 'hybrid' } });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.42' } });
    fireEvent.change(screen.getByLabelText(label('ollamaModel')), { target: { value: 'qwen' } });
    fireEvent.change(screen.getByLabelText(label('labelModel')), { target: { value: 'labeler' } });
    fireEvent.click(screen.getByRole('button', { name: label('run') }));
    expect(updateSettings).toHaveBeenNthCalledWith(1, { provider: 'hybrid', threshold: null });
    expect(updateSettings).toHaveBeenNthCalledWith(2, { threshold: 0.42 });
    expect(updateSettings).toHaveBeenNthCalledWith(3, { ollamaModel: 'qwen' });
    expect(updateSettings).toHaveBeenNthCalledWith(4, { labelModel: 'labeler' });
    expect(run).toHaveBeenCalledOnce();
    expect(screen.getByTestId('embedding-result').textContent).toBe('result:local-hash');
  });

  it('covers project and keyword limits plus loading and local label-model states', () => {
    const view = render(<EmbeddingClusteringPanel projectId={null} keywords={[]} />);
    let button = screen.getByRole('button', { name: label('run') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(i18n.t('keywordClusteringUi.minimumKeywordsError'))).toBeTruthy();
    expect(screen.queryByLabelText(label('ollamaModel'))).toBeNull();

    configure({ settings: settings({ labelModel: 'local-label' }) });
    view.rerender(<EmbeddingClusteringPanel projectId="p1" keywords={Array.from({ length: 2001 }, (_, index) => `kw-${index}`)} />);
    expect(screen.getByText(label('tooMany', { max: 2000 }))).toBeTruthy();
    expect((screen.getByRole('button', { name: label('run') }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(label('ollamaHint'))).toBeTruthy();
    expect(screen.queryByLabelText(label('ollamaModel'))).toBeNull();

    configure({ settings: settings({ provider: 'ollama' }), isRunning: true, error: 'offline' });
    view.rerender(<EmbeddingClusteringPanel projectId="p1" keywords={['one', 'two']} />);
    button = screen.getByRole('button', { name: label('running') }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('offline');
    expect((screen.getByLabelText(label('ollamaModel')) as HTMLInputElement).disabled).toBe(true);
  });
});
