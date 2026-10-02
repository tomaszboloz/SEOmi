import { beforeEach, describe, expect, it } from 'vitest';
import {
  PROVIDERS, SECRET_NAMES, defaultModel, isAiProvider, isConnectionMethod,
  projectPreferenceKey, providerMap, resolveGlobalAiPreferences, beginAuthRequest, isLatestAuthRequest,
} from '@/stores/auth/runtime';

beforeEach(() => localStorage.clear());

describe('AI preference primitives', () => {
  it('names every provider, its secret and its default model', () => {
    expect(PROVIDERS).toEqual(['openai', 'claude', 'gemini']);
    expect(SECRET_NAMES).toEqual({ openai: 'openai_api_key', claude: 'claude_api_key', gemini: 'gemini_api_key' });
    expect(PROVIDERS.map(defaultModel)).toEqual(['gpt-4o', 'claude-opus-5', 'gemini-3.8-flash']);
    expect(providerMap(0)).toEqual({ openai: 0, claude: 0, gemini: 0 });
  });

  it('accepts only known providers and connection methods', () => {
    expect([null, '', 'OpenAI', 'mistral', 'claude'].map(isAiProvider)).toEqual([false, false, false, false, true]);
    expect([null, 'api', 'local_cli', 'api_key'].map(isConnectionMethod)).toEqual([false, false, true, true]);
  });

  it('encodes project IDs so a crafted ID cannot address another key', () => {
    expect(projectPreferenceKey('a_b/c', 'model')).toBe('seomi_project_a_b%2Fc_ai_model');
  });
});

describe('global AI preferences', () => {
  it('defaults to OpenAI with API keys when nothing is stored', () => {
    expect(resolveGlobalAiPreferences()).toEqual({ provider: 'openai', model: 'gpt-4o', connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' } });
  });

  it('ignores corrupted provider and connection values', () => {
    localStorage.setItem('seomi_ai_provider', 'mistral');
    localStorage.setItem('seomi_ai_connection_claude', 'telepathy');
    const prefs = resolveGlobalAiPreferences();
    expect(prefs.provider).toBe('openai');
    expect(prefs.connectionMethod.claude).toBe('api_key');
  });

  it('uses the stored provider default instead of an OpenAI model when no model is stored', () => {
    localStorage.setItem('seomi_ai_provider', 'claude');
    localStorage.setItem('seomi_ai_model', '   ');
    expect(resolveGlobalAiPreferences().model).toBe('claude-opus-5');
  });

  it('migrates a retired stored model and keeps a valid CLI connection', () => {
    localStorage.setItem('seomi_ai_provider', 'gemini');
    localStorage.setItem('seomi_ai_model', 'gemini-2.0-flash');
    localStorage.setItem('seomi_ai_connection_gemini', 'local_cli');
    expect(resolveGlobalAiPreferences()).toMatchObject({ provider: 'gemini', model: 'gemini-3.8-flash', connectionMethod: { gemini: 'local_cli' } });
  });
});

describe('auth request tokens', () => {
  it('treats only the newest request of a kind as current', () => {
    const first = beginAuthRequest('kind-a');
    const second = beginAuthRequest('kind-a');
    const other = beginAuthRequest('kind-b');
    expect(first).not.toBe(second);
    expect(isLatestAuthRequest('kind-a', first)).toBe(false);
    expect(isLatestAuthRequest('kind-a', second)).toBe(true);
    expect(isLatestAuthRequest('kind-b', other)).toBe(true);
    expect(isLatestAuthRequest('never-started', first)).toBe(false);
  });
});
