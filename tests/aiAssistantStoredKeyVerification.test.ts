import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAIAssistantSession } from '@/components/AI/assistant/useAIAssistantSession';
import { auth, project, generate, connected, testConnection, setApiKey, suggestion, resetAssistant, deferred } from './fixtures/aiAssistantSession';

vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/aiAssistantSession')).audit }));
vi.mock('@/stores/authStore', async () => ({ useAuthStore: (await import('./fixtures/aiAssistantSession')).auth }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/aiAssistantSession')).project }));
vi.mock('@/stores/uiStore', async () => ({ useUIStore: (await import('./fixtures/aiAssistantSession')).ui }));
vi.mock('@/services/clipboard', async () => ({ copyText: (await import('./fixtures/aiAssistantSession')).clipboard }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const marker = '__seomi_secret_present__';
beforeEach(() => {
  resetAssistant();
  connected.mockReturnValue(false);
  auth.setState({ apiKeys: { openai: marker, claude: '', gemini: '' } });
});

it('verifies a stored key on first use instead of sending the user to the connection dialog', async () => {
  testConnection.mockResolvedValueOnce({ success: true, message: 'ok' });
  const { result } = renderHook(useAIAssistantSession);
  expect(result.current.keyStored).toBe(true);
  await act(async () => { await result.current.handleGenerate(); });
  expect(testConnection).toHaveBeenCalledExactlyOnceWith('openai');
  expect(result.current.suggestions).toEqual(suggestion);
  expect(result.current.error).toBeNull();
});

it('shows why the stored key failed and does not generate', async () => {
  testConnection.mockResolvedValueOnce({ success: false, message: 'Invalid OpenAI API key' });
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleGenerate(); });
  expect(result.current.error).toBe('Invalid OpenAI API key');
  expect(generate).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
});

it.each([
  ['no key is stored', { apiKeys: { openai: '', claude: '', gemini: '' } }],
  ['the provider uses a local CLI', { connectionMethod: { openai: 'local_cli', claude: 'api_key', gemini: 'api_key' } }],
])('asks for a connection without testing when %s', async (_name, state) => {
  auth.setState(state);
  const { result } = renderHook(useAIAssistantSession);
  expect(result.current.keyStored).toBe(Boolean(auth.getState().apiKeys.openai));
  await act(async () => { await result.current.handleGenerate(); });
  expect(testConnection).not.toHaveBeenCalled();
  expect(result.current.error).toBe('ai.connectBeforeGenerate');
});

it('drops a verification that finishes after the project changed', async () => {
  const pending = deferred<{ success: boolean; message: string }>();
  testConnection.mockReturnValueOnce(pending.promise);
  const { result } = renderHook(useAIAssistantSession);
  let job!: Promise<void>;
  act(() => { job = result.current.handleGenerate(); });
  act(() => project.setState({ activeProjectId: 'two' }));
  await act(async () => { pending.resolve({ success: false, message: 'late' }); await job; });
  expect(result.current.error).toBeNull();
  expect(generate).not.toHaveBeenCalled();
});

it('returns the key write so the field can report the outcome', async () => {
  const { result } = renderHook(useAIAssistantSession);
  await act(async () => { await result.current.handleApiKeyChange('sk-new'); });
  expect(setApiKey).toHaveBeenCalledExactlyOnceWith('openai', 'sk-new');
  setApiKey.mockRejectedValueOnce(new Error('vault failed'));
  await act(async () => { await expect(result.current.handleApiKeyChange('sk-2')).rejects.toThrow('vault failed'); });
  expect(result.current.error).toBe('vault failed');
});
