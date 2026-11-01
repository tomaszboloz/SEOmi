import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { ReferenceMapPanel } from '@/components/Domain/crawlResults/authority/ReferenceMapPanel';
import { defaultReferenceRunner, useTopicalAuthority } from '@/hooks/useTopicalAuthority';
import { readEntitySettings } from '@/services/topicalAuthorityMonitoring';
import { createReferenceDeps, referenceMarket } from '@/services/topicalAuthorityReference';
import { OWN_HOST, ownReport, ownSite } from './authorityFixtures';

const runReference = vi.hoisted(() => vi.fn().mockResolvedValue({ status: 'cancelled' }));
vi.mock('@/services/topicalAuthorityReference/run', () => ({ runReference }));

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const IDLE = { running: false, progress: null, failure: null, error: null };
beforeEach(() => { localStorage.clear(); runReference.mockClear(); });

describe('entity recognition setting UI', () => {
  it('offers the three modes, asks for a model only in ollama mode and reports changes', () => {
    const onEntities = vi.fn();
    const view = render(<ReferenceMapPanel taxonomy={null} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} entities={{ mode: 'lexical', model: '' }} onEntities={onEntities} />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Focus terms only (default)', 'Local name detection', 'Local name detection + Ollama model']);
    expect(screen.queryByPlaceholderText('llama3.2')).toBeNull();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ollama' } });
    expect(onEntities).toHaveBeenCalledWith({ mode: 'ollama', model: '' });
    view.rerender(<ReferenceMapPanel taxonomy={null} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} entities={{ mode: 'ollama', model: '' }} onEntities={onEntities} />);
    fireEvent.change(screen.getByPlaceholderText('llama3.2'), { target: { value: 'qwen3' } });
    expect(onEntities).toHaveBeenLastCalledWith({ mode: 'ollama', model: 'qwen3' });
  });

  it('hides the control when not wired', () => {
    render(<ReferenceMapPanel taxonomy={null} state={IDLE} onBuild={vi.fn()} onCancel={vi.fn()} onClear={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});

describe('hook passes the entity setting to the runner', () => {
  const sfs = ownReport(pages);
  it('stores the choice per project and hands mode and model to the runner', async () => {
    const runner = vi.fn().mockResolvedValue({ status: 'cancelled' });
    const hook = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs, projectId: 'en1', runner }));
    expect(hook.result.current.entities).toEqual({ mode: 'lexical', model: '' });
    act(() => hook.result.current.saveEntities({ mode: 'ollama', model: 'qwen3' }));
    expect(readEntitySettings('en1')).toEqual({ mode: 'ollama', model: 'qwen3' });
    await act(async () => { await hook.result.current.build({ withQuestions: true }); });
    expect(runner.mock.calls[0][1]).toEqual({ withQuestions: true, entityMode: 'ollama', ollamaModel: 'qwen3' });
    await act(async () => { await hook.result.current.build(); });
    act(() => hook.result.current.saveEntities({ mode: 'heuristic', model: '' }));
    await act(async () => { await hook.result.current.build(); });
    expect(runner.mock.calls.at(-1)?.[1]).toMatchObject({ entityMode: 'heuristic', ollamaModel: undefined });
    const none = renderHook(() => useTopicalAuthority({ pages, startUrl: START, sfs, projectId: null, runner }));
    act(() => none.result.current.saveEntities({ mode: 'heuristic', model: '' }));
    expect(none.result.current.entities.mode).toBe('lexical');
  });

  it('default runner forwards the entity mode to the reference run', async () => {
    await defaultReferenceRunner({ report: sfs, startUrl: START }, { entityMode: 'heuristic' });
    expect(runReference.mock.calls[0][1]).toMatchObject({ entityMode: 'heuristic' });
    await defaultReferenceRunner({ report: sfs, startUrl: START });
    expect(runReference.mock.calls[1][1].entityMode).toBeUndefined();
  });

  it('reference deps fall back to the default market when the keyword settings are empty', async () => {
    const { useToolsStore } = await import('@/stores/toolsStore');
    useToolsStore.setState({ keywordCountry: '', keywordLanguage: '' });
    expect(createReferenceDeps().fetchSuggestions).toBeTypeOf('function');
    expect(referenceMarket()).toEqual({ country: 'US', language: 'en' });
    useToolsStore.setState({ keywordCountry: 'PL', keywordLanguage: 'pl' });
    expect(createReferenceDeps().fetchSuggestions).toBeTypeOf('function');
    expect(referenceMarket()).toEqual({ country: 'PL', language: 'pl' });
  });

  it('reference deps expose the local recogniser only with a model name', async () => {
    expect(createReferenceDeps().extractEntities).toBeUndefined();
    const deps = createReferenceDeps({ ollamaModel: 'qwen3' });
    await waitFor(async () => expect(await deps.extractEntities!(['Sony A7IV review'])).toEqual([]));
  });
});
