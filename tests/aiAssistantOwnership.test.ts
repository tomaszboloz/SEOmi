import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useAIAssistantSession } from '@/components/AI/assistant/useAIAssistantSession';
import { audit, auth, project, generate, connected, setApiKey, clipboard, suggestion, resetAssistant, deferred } from './fixtures/aiAssistantSession';
import type { AiSuggestionResponse } from '@/services/ai';

vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/aiAssistantSession')).audit }));
vi.mock('@/stores/authStore', async () => ({ useAuthStore: (await import('./fixtures/aiAssistantSession')).auth }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/aiAssistantSession')).project }));
vi.mock('@/stores/uiStore', async () => ({ useUIStore: (await import('./fixtures/aiAssistantSession')).ui }));
vi.mock('@/services/clipboard', async () => ({ copyText: (await import('./fixtures/aiAssistantSession')).clipboard }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(resetAssistant);
afterEach(() => vi.useRealTimers());

it.each(['project', 'url', 'model', 'provider', 'timestamp', 'connection', 'prompt', 'key-input', 'key-storage'])('rejects old generated suggestions after changing %s', async kind => {
  const pending = deferred<AiSuggestionResponse>(); generate.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  let job!: Promise<void>;
  act(() => { job = result.current.handleGenerate(); });
  act(() => {
    if (kind === 'project') project.setState({ activeProjectId: 'two' });
    if (kind === 'url') audit.setState({ currentAudit: { ...audit.getState().currentAudit!, url: 'https://other.test' } });
    if (kind === 'model') auth.setState({ model: 'gpt-4o-mini' });
    if (kind === 'provider') auth.setState({ provider: 'claude' });
    if (kind === 'timestamp') audit.setState({ currentAudit: { ...audit.getState().currentAudit!, timestamp: '2026-10-04' } });
    if (kind === 'connection') auth.setState({ connectionMethod: { ...auth.getState().connectionMethod, openai: 'local_cli' } });
    if (kind === 'prompt') result.current.setPromptInstruction('New instructions');
    if (kind === 'key-input') result.current.handleApiKeyChange('new-key');
    if (kind === 'key-storage') auth.setState({ apiKeys: { ...auth.getState().apiKeys, openai: 'another-key' } });
  });
  await act(async () => { pending.resolve(suggestion); await job; });
  expect(result.current.suggestions).toBeNull();
  expect(result.current.loading).toBe(false);
});

it('ignores an old API key rejection after switching provider', async () => {
  const pending = deferred<void>(); setApiKey.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  act(() => result.current.handleApiKeyChange('old-key'));
  act(() => auth.setState({ provider: 'claude' }));
  await act(async () => { pending.reject(new Error('old write')); await pending.promise.catch(() => {}); });
  expect(result.current.error).toBeNull();
});

it('does not display copied feedback from a previous project', async () => {
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  const pending = deferred<boolean>(); clipboard.mockReturnValueOnce(pending.promise);
  let job!: Promise<void>;
  act(() => { job = result.current.copySchema(); });
  act(() => project.setState({ activeProjectId: 'two' }));
  await act(async () => { pending.resolve(true); await job; });
  expect(result.current.copiedJson).toBe(false);
});

it('retains the newer applied-field feedback until its own timer expires', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  act(() => result.current.applyTitle());
  act(() => vi.advanceTimersByTime(1000));
  act(() => result.current.applyDescription());
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.appliedField).toBe('desc');
  act(() => vi.advanceTimersByTime(1000));
  expect(result.current.appliedField).toBeNull();
});

it('rejects an older generation after a newer disconnected attempt', async () => {
  const pending = deferred<AiSuggestionResponse>(); generate.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  let job!: Promise<void>;
  act(() => { job = result.current.handleGenerate(); });
  connected.mockReturnValue(false);
  await act(async () => { await result.current.handleGenerate(); });
  expect(result.current.error).toBe('ai.connectBeforeGenerate');
  expect(result.current.loading).toBe(false);
  await act(async () => { pending.resolve(suggestion); await job; });
  expect(result.current.suggestions).toBeNull();
  expect(result.current.error).toBe('ai.connectBeforeGenerate');
});

it('retains latest generation loading/result ownership across an older error', async () => {
  const old = deferred<AiSuggestionResponse>(); const latest = deferred<AiSuggestionResponse>();
  generate.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const { result } = renderHook(useAIAssistantSession);
  let first!: Promise<void>; let second!: Promise<void>;
  act(() => { first = result.current.handleGenerate(); second = result.current.handleGenerate(); });
  await act(async () => { old.reject(new Error('old failure')); await first; });
  expect(result.current.loading).toBe(true); expect(result.current.error).toBeNull();
  await act(async () => { latest.resolve(suggestion); await second; });
  expect(result.current.suggestions).toEqual(suggestion); expect(result.current.loading).toBe(false);
});

it('does not regain ownership when the user returns to the original project', async () => {
  const pending = deferred<AiSuggestionResponse>(); generate.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  let job!: Promise<void>;
  act(() => { job = result.current.handleGenerate(); });
  act(() => project.setState({ activeProjectId: 'two' }));
  act(() => project.setState({ activeProjectId: 'one' }));
  await act(async () => { pending.resolve(suggestion); await job; });
  expect(result.current.suggestions).toBeNull();
});
