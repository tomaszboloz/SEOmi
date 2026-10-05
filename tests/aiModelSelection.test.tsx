import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { ProviderModelSelect } from '@/components/AI/ProviderModelSelect';
import { useAuthStore } from '@/stores/authStore';
import { readCachedModels } from '@/stores/auth/models';
import * as modelList from '@/services/ai/modelList';

const initial = useAuthStore.getState();
const keys = { openai: '', claude: 'sk-test', gemini: '' };
beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  useAuthStore.setState({ provider: 'claude', model: 'claude-opus-5', apiKeys: keys, connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
    availableModels: { openai: [], claude: [], gemini: [] }, modelListStatus: { openai: 'idle', claude: 'idle', gemini: 'idle' } });
});
afterEach(() => { useAuthStore.setState(initial, true); vi.restoreAllMocks(); });

describe('model list in the store', () => {
  it('stores and caches the provider list, keeping the cached copy valid', async () => {
    vi.spyOn(modelList, 'listProviderModels').mockResolvedValue([{ id: 'claude-opus-5', label: 'Claude Opus 5' }, { id: 'claude-x', label: 'Claude X' }]);
    await act(() => useAuthStore.getState().refreshProviderModels('claude'));
    expect(useAuthStore.getState().availableModels.claude.map(model => model.id)).toEqual(['claude-opus-5', 'claude-x']);
    expect(readCachedModels('claude').map(model => model.id)).toEqual(['claude-opus-5', 'claude-x']);
  });

  it('keeps the previous list and reports an error when listing fails', async () => {
    useAuthStore.setState({ availableModels: { openai: [], claude: [{ id: 'claude-opus-5', label: 'Claude Opus 5' }], gemini: [] } });
    vi.spyOn(modelList, 'listProviderModels').mockRejectedValue(new Error('offline'));
    await act(() => useAuthStore.getState().refreshProviderModels('claude'));
    expect(useAuthStore.getState().modelListStatus.claude).toBe('error');
    expect(useAuthStore.getState().availableModels.claude).toHaveLength(1);
  });

  it('does not list models for a CLI connection or a missing key', async () => {
    const spy = vi.spyOn(modelList, 'listProviderModels');
    useAuthStore.setState({ connectionMethod: { openai: 'api_key', claude: 'local_cli', gemini: 'api_key' } });
    await useAuthStore.getState().refreshProviderModels('claude');
    await useAuthStore.getState().refreshProviderModels('gemini');
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores corrupted or retired cached entries', () => {
    localStorage.setItem('seomi_ai_models_openai_v1', '{bad');
    expect(readCachedModels('openai')).toEqual([]);
    localStorage.setItem('seomi_ai_models_openai_v1', JSON.stringify([{ id: 'o3-mini', label: 'o3-mini' }, { id: 'gpt-6-astra', label: 'gpt-6-astra' }]));
    expect(readCachedModels('openai').map(model => model.id)).toEqual(['gpt-6-astra']);
  });

  it('loads the model list after a successful API-key connection test', async () => {
    const { AIService } = await import('@/services/ai');
    vi.spyOn(AIService, 'testConnection').mockResolvedValue({ success: true, message: 'ok' });
    const spy = vi.spyOn(modelList, 'listProviderModels').mockResolvedValue([{ id: 'claude-x', label: 'Claude X' }]);
    await act(() => useAuthStore.getState().testProviderConnection('claude'));
    await waitFor(() => expect(useAuthStore.getState().availableModels.claude).toEqual([{ id: 'claude-x', label: 'Claude X' }]));
    expect(spy).toHaveBeenCalledWith('claude', 'sk-test');
  });
});

describe('provider model select', () => {
  it('offers default models before listing and the fetched models afterwards', async () => {
    render(<ProviderModelSelect provider="claude" ariaLabel="Model" className="" />);
    const select = screen.getByRole('combobox', { name: 'Model' });
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual(['Claude Opus 5', 'Claude Sonnet 5', 'Claude Haiku 4.5']);
    expect(screen.getByText(i18n.t('auth.modelsDefault'))).toBeTruthy();
    vi.spyOn(modelList, 'listProviderModels').mockResolvedValue([{ id: 'claude-opus-5', label: 'Claude Opus 5' }, { id: 'claude-x', label: 'Claude X' }]);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: i18n.t('auth.refreshModels') })); });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    expect(screen.getByText(i18n.t('auth.modelsFromProvider', { count: 2 }))).toBeTruthy();
    fireEvent.change(select, { target: { value: 'claude-x' } });
    expect(useAuthStore.getState().model).toBe('claude-x');
  });

  it('disables refresh without a key and shows listing errors', () => {
    useAuthStore.setState({ apiKeys: { ...keys, claude: '' }, modelListStatus: { openai: 'idle', claude: 'error', gemini: 'idle' } });
    render(<ProviderModelSelect provider="claude" ariaLabel="Model" className="" />);
    expect((screen.getByRole('button', { name: i18n.t('auth.refreshModels') }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('auth.modelsUnavailable'));
  });
});
