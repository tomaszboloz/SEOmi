import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AIAssistantApiKeyInput } from '@/components/AI/assistant/AIAssistantApiKeyInput';
import { AiSearchHistoryAndContext } from '@/components/AiVisibility/searchPrompts/AiSearchHistoryAndContext';
import { ProviderActiveControls } from '@/components/Auth/subscriptionModal/ProviderActiveControls';
import { KeywordClustering } from '@/components/Keywords/KeywordClustering';
import { RankTrackingHeader } from '@/components/Keywords/rankTracking/RankTrackingHeader';
import { useCommandPaletteSession } from '@/components/Layout/commandPalette/useCommandPaletteSession';
import { useProjectStore } from '@/stores/projectStore';
import { methodKey } from '@/components/Keywords/embeddingClustering/ClusteringMethodSwitch';
import type { AiConnectionState, AiPromptComparison, AiProvider } from '@/types';
import { createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/components/Results/ShowOnPageButton', () => ({ ShowOnPageButton: () => null }));

const t = i18n.t.bind(i18n) as never;

beforeEach(async () => { await i18n.changeLanguage('en'); });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('AI assistant API key input', () => {
  const render_ = (method: string) => render(
    <AIAssistantApiKeyInput
      provider="openai" keyStored={false} handleApiKeyChange={vi.fn()} connectionMethod={{ openai: method, claude: 'api_key', gemini: 'api_key' } as Record<AiProvider, string>}
      openSubscriptionModal={vi.fn()} promptInstruction="" setPromptInstruction={vi.fn()} t={t}
    />,
  );

  it('disables the key field and shows the CLI placeholder for a local CLI connection', () => {
    render_('local_cli');
    const input = screen.getByLabelText(new RegExp(i18n.t('ai.apiKeyLabel', { provider: 'OPENAI' }))) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe(i18n.t('ai.localCliPlaceholder'));
  });

  it('keeps the key field editable for API key connections', () => {
    render_('api_key');
    const input = screen.getByLabelText(new RegExp(i18n.t('ai.apiKeyLabel', { provider: 'OPENAI' }))) as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.placeholder).toBe(i18n.t('ai.apiKeyPlaceholder', { provider: 'OPENAI' }));
  });
});

describe('AI search history and source context', () => {
  const comparison = { prompt: 'p', captured_at: 'not-a-date', results: [] } as unknown as AiPromptComparison;

  it('shows placeholders for unparsable dates and surfaces the source context state', () => {
    const run = createCrawlRunFixture({ id: 'ctx-run', completedAt: 'also-not-a-date' });
    render(
      <AiSearchHistoryAndContext
        comparison={comparison} history={[comparison]} onSelectHistory={vi.fn()} crawlRuns={[run]} sourceContextRunId="ctx-run"
        sourceContextRun={run} sourceContextSaveError onSelectSourceContextRun={vi.fn()} t={t}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('aiVisibility.search.sourceSaveError'));
    expect(screen.getByText(i18n.t('aiVisibility.search.evidenceRun', { id: 'ctx-run', date: '—', count: run.result.pages.length }))).toBeTruthy();
  });
});

describe('subscription provider controls', () => {
  const item = { id: 'openai' } as never;
  const controls = (status: AiConnectionState) => render(
    <ProviderActiveControls item={item} method="local_cli" status={status} statusMessage="status text" saving={false} onTestConnection={vi.fn()} t={t} />,
  );

  it('shows a spinner and disables the test button while testing', () => {
    const { container } = controls('testing');
    expect(container.querySelector('svg.animate-spin')).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('colors the message by outcome', () => {
    controls('error');
    expect(screen.getByText('status text').className).toContain('text-rose-400');
  });
});

describe('keyword clustering method without a project', () => {
  it('switches the method without persisting it', () => {
    localStorage.clear();
    useProjectStore.setState({ activeProjectId: null });
    render(<KeywordClustering />);
    const radios = screen.getAllByRole('radio');
    const target = radios.find((radio) => radio.getAttribute('aria-checked') === 'false') as HTMLElement;
    fireEvent.click(target);
    expect(target.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem(methodKey('anything'))).toBeNull();
    expect(Object.keys(localStorage)).toEqual([]);
  });
});

describe('rank tracking header while refreshing', () => {
  it('disables the refresh button and shows the updating label', () => {
    render(<RankTrackingHeader totalTracked={3} isRankLoading onRefreshAll={vi.fn()} onOpenAddModal={vi.fn()} t={t} />);
    const button = screen.getByText(i18n.t('rankTrackingUi.updating')).closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('svg.animate-spin')).toBeTruthy();
  });
});

describe('command palette focus capture', () => {
  it('does not remember a focus target that is not an HTML element', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null);
    const view = renderHook(() => useCommandPaletteSession({ open: true, close: vi.fn(), filteredItems: [] }));
    expect(view.result.current.activeIndex).toBe(0);
    expect(() => view.unmount()).not.toThrow();
  });
});
