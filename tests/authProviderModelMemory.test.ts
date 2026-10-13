import { beforeEach, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { initialModel, providerModelKey, projectPreferenceKey } from '@/stores/auth/runtime';

const listed = { openai: [{ id: 'gpt-6.1-sol', label: 'gpt-6.1-sol' }, { id: 'gpt-4o', label: 'gpt-4o' }], claude: [], gemini: [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }] };

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ activeProjectId: null, provider: 'openai', model: 'gpt-4o', availableModels: { openai: [], claude: [], gemini: [] } });
});

it('starts OpenAI with the newest listed model and other providers with their maintained default', () => {
  expect(initialModel('openai')).toBe('gpt-4o');
  expect(initialModel('openai', listed.openai)).toBe('gpt-6.1-sol');
  expect(initialModel('gemini', listed.gemini)).toBe('gemini-3.8-flash');
  expect(initialModel('claude', [{ id: 'claude-x' }])).toBe('claude-opus-5');
});

it('returns to the model chosen for a provider after switching away and back', () => {
  const store = useAuthStore.getState();
  store.setModel('gpt-6.1-sol');
  expect(localStorage.getItem(providerModelKey('openai'))).toBe('gpt-6.1-sol');
  store.setProvider('gemini');
  expect(useAuthStore.getState().model).toBe('gemini-3.8-flash');
  useAuthStore.getState().setModel('gemini-3.5-flash');
  useAuthStore.getState().setProvider('openai');
  expect(useAuthStore.getState().model).toBe('gpt-6.1-sol');
  useAuthStore.getState().setProvider('gemini');
  expect(useAuthStore.getState().model).toBe('gemini-3.5-flash');
});

it('prefers the choice made in the active project over the global one', () => {
  localStorage.setItem(providerModelKey('openai'), 'gpt-5.4');
  useAuthStore.setState({ activeProjectId: 'p1', provider: 'openai' });
  useAuthStore.getState().setModel('gpt-6.1-sol');
  expect(localStorage.getItem(projectPreferenceKey('p1', 'model_openai'))).toBe('gpt-6.1-sol');
  useAuthStore.setState({ activeProjectId: 'p2', provider: 'claude' });
  useAuthStore.getState().setProvider('openai');
  expect(useAuthStore.getState().model).toBe('gpt-6.1-sol');
  localStorage.setItem(projectPreferenceKey('p2', 'model_openai'), 'gpt-5.4-mini');
  useAuthStore.getState().setProvider('openai');
  expect(useAuthStore.getState().model).toBe('gpt-5.4-mini');
});

it('falls back to the newest listed model, and rewrites a remembered model that was retired', () => {
  useAuthStore.setState({ provider: 'claude', availableModels: listed });
  useAuthStore.getState().setProvider('openai');
  expect(useAuthStore.getState().model).toBe('gpt-6.1-sol');
  localStorage.setItem(providerModelKey('openai'), 'o3-mini');
  useAuthStore.getState().setProvider('openai');
  expect(useAuthStore.getState().model).toBe('gpt-4o-mini');
});

it('gives a project without stored preferences the newest listed OpenAI model', () => {
  localStorage.setItem('seomi_ai_project_preferences_migrated_v1', '1');
  useAuthStore.setState({ availableModels: listed });
  useAuthStore.getState().hydrateProject('fresh');
  expect(useAuthStore.getState().model).toBe('gpt-6.1-sol');
});
