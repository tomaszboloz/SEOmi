import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAIAssistantSession } from '@/components/AI/assistant/useAIAssistantSession';
import { audit, generate, connected, setApiKey, clipboard, setAuditData, openModal, closeModal, suggestion, resetAssistant, deferred } from './fixtures/aiAssistantSession';

vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/aiAssistantSession')).audit }));
vi.mock('@/stores/authStore', async () => ({ useAuthStore: (await import('./fixtures/aiAssistantSession')).auth }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/aiAssistantSession')).project }));
vi.mock('@/stores/uiStore', async () => ({ useUIStore: (await import('./fixtures/aiAssistantSession')).ui }));
vi.mock('@/services/clipboard', async () => ({ copyText: (await import('./fixtures/aiAssistantSession')).clipboard }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { provider?: string }) => options?.provider ? `${key}:${options.provider}` : key }) }));
beforeEach(resetAssistant);
afterEach(() => vi.useRealTimers());

it('forwards modal/provider/model actions and exposes current or absent provider keys', () => {
  const { result } = renderHook(useAIAssistantSession);
  expect(result.current.currentKey).toBe('fixture-key');
  act(() => { result.current.openSubscriptionModal(); result.current.closeModal(); });
  expect(openModal).toHaveBeenCalledExactlyOnceWith('subscription'); expect(closeModal).toHaveBeenCalledOnce();
  act(() => result.current.setProvider('claude'));
  expect(result.current.provider).toBe('claude'); expect(result.current.currentKey).toBe('');
  act(() => result.current.setModel('new-model'));
  expect(result.current.model).toBe('new-model');
});

it('requires an audit and an established provider connection', async () => {
  audit.setState({ currentAudit: null });
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); await result.current.copySchema(); });
  act(() => { result.current.applyTitle(); result.current.applyDescription(); });
  expect(generate).not.toHaveBeenCalled(); expect(clipboard).not.toHaveBeenCalled(); expect(setAuditData).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  act(resetAssistant); connected.mockReturnValue(false);
  await act(async () => { await result.current.handleGenerate(); });
  expect(result.current.error).toBe('ai.connectBeforeGenerate:OPENAI');
  expect(generate).not.toHaveBeenCalled();
});

it('passes the exact audit and user instruction and applies metadata without dropping unrelated fields', async () => {
  vi.useFakeTimers();
  const original = audit.getState().currentAudit!;
  const { result } = renderHook(useAIAssistantSession);
  act(() => result.current.setPromptInstruction('Keep facts'));
  await act(async () => { await result.current.handleGenerate(); });
  expect(generate).toHaveBeenCalledExactlyOnceWith(original, 'Keep facts');
  expect(result.current.suggestions).toEqual(suggestion);
  act(() => result.current.applyTitle());
  const title = { ...original, meta_tags: { ...original.meta_tags, title: suggestion.suggestedTitle, title_length: suggestion.suggestedTitle.length }, open_graph: { ...original.open_graph, og_title: suggestion.suggestedTitle } };
  expect(setAuditData).toHaveBeenLastCalledWith(title);
  expect(result.current.appliedField).toBe('title');
  act(() => result.current.applyDescription());
  expect(setAuditData).toHaveBeenLastCalledWith({ ...title, meta_tags: { ...title.meta_tags, description: suggestion.suggestedDescription, description_length: suggestion.suggestedDescription.length }, open_graph: { ...title.open_graph, og_description: suggestion.suggestedDescription } });
  expect(result.current.suggestions).toEqual(suggestion);
  act(() => vi.advanceTimersByTime(2000)); expect(result.current.appliedField).toBeNull();
});

it.each([new Error('provider failed'), 'provider rejected'])('reports a current generation error and recovers on retry: %s', async failure => {
  generate.mockRejectedValueOnce(failure);
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  expect(result.current.error).toBe(failure instanceof Error ? failure.message : failure);
  expect(result.current.loading).toBe(false);
  await act(async () => { await result.current.handleGenerate(); });
  expect(result.current.error).toBeNull(); expect(result.current.suggestions).toEqual(suggestion);
});

it.each([new Error('vault failed'), 'vault rejected'])('reports a current key write failure: %s', async failure => {
  const pending = deferred<void>(); setApiKey.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  act(() => result.current.handleApiKeyChange('new-key'));
  expect(setApiKey).toHaveBeenCalledExactlyOnceWith('openai', 'new-key');
  await act(async () => { pending.reject(failure); await pending.promise.catch(() => {}); });
  expect(result.current.error).toBe(failure instanceof Error ? failure.message : failure);
});

it('ignores an older key rejection after a newer successful generation', async () => {
  const pending = deferred<void>(); setApiKey.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  act(() => result.current.handleApiKeyChange('new-key'));
  await act(async () => { await result.current.handleGenerate(); });
  await act(async () => { pending.reject(new Error('old failure')); await pending.promise.catch(() => {}); });
  expect(result.current.error).toBeNull(); expect(result.current.suggestions).toEqual(suggestion);
});

it('copies exact formatted schema JSON only after acceptance and clears its feedback timer', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  await act(async () => { await result.current.copySchema(); });
  expect(clipboard).toHaveBeenCalledExactlyOnceWith(JSON.stringify(suggestion.schemaJsonLd, null, 2));
  expect(result.current.copiedJson).toBe(true);
  act(() => vi.advanceTimersByTime(2000)); expect(result.current.copiedJson).toBe(false);
});

it.each([false, new Error('clipboard failed'), 'clipboard rejected'])('handles clipboard refusal or failure: %s', async outcome => {
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  if (outcome === false) clipboard.mockResolvedValueOnce(false); else clipboard.mockRejectedValueOnce(outcome);
  await act(async () => { await result.current.copySchema(); });
  expect(result.current.copiedJson).toBe(false);
  expect(result.current.error).toBe(outcome === false ? null : outcome instanceof Error ? outcome.message : outcome);
});
