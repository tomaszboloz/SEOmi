import { describe, expect, it } from 'vitest';
import {
  providerMap,
  defaultModel,
  statusFromDetectedCli,
  isAiProvider,
  isConnectionMethod,
  projectPreferenceKey,
  beginAuthRequest,
  isLatestAuthRequest,
  resolveGlobalAiPreferences,
  PROVIDERS,
  SECRET_NAMES,
} from '@/stores/auth/runtime';

describe('auth runtime direct assertions', () => {
  it('PROVIDERS and SECRET_NAMES define supported AI providers and key names', () => {
    expect(PROVIDERS).toEqual(['openai', 'claude', 'gemini']);
    expect(SECRET_NAMES.openai).toBe('openai_api_key');
    expect(SECRET_NAMES.claude).toBe('claude_api_key');
    expect(SECRET_NAMES.gemini).toBe('gemini_api_key');
  });

  it('providerMap creates a record with values for every provider', () => {
    const mapped = providerMap('test-val');
    expect(mapped).toEqual({
      openai: 'test-val',
      claude: 'test-val',
      gemini: 'test-val',
    });
  });

  it('defaultModel returns provider-appropriate default model names', () => {
    expect(defaultModel('openai')).toBe('gpt-4o');
    expect(defaultModel('claude')).toBeTruthy();
    expect(defaultModel('gemini')).toBeTruthy();
  });

  it('statusFromDetectedCli connects only for providers where detection proves connection', () => {
    const cliAvailable = { available: true, path: '/usr/bin/ai', version: '1.0' } as any;
    const cliUnavailable = { available: false, path: null, version: null } as any;

    expect(statusFromDetectedCli('openai', 'local_cli', cliAvailable)).toBe('connected');
    expect(statusFromDetectedCli('claude', 'local_cli', cliAvailable)).toBe('connected');
    // Gemini has no sign-in check; detection does not prove connection
    expect(statusFromDetectedCli('gemini', 'local_cli', cliAvailable)).toBe('unconfigured');

    expect(statusFromDetectedCli('openai', 'api_key', cliAvailable)).toBe('unconfigured');
    expect(statusFromDetectedCli('openai', 'local_cli', cliUnavailable)).toBe('unconfigured');
    expect(statusFromDetectedCli('openai', 'local_cli', null)).toBe('unconfigured');
  });

  it('isAiProvider and isConnectionMethod validate string discriminants', () => {
    expect(isAiProvider('openai')).toBe(true);
    expect(isAiProvider('claude')).toBe(true);
    expect(isAiProvider('gemini')).toBe(true);
    expect(isAiProvider('other')).toBe(false);
    expect(isAiProvider(null)).toBe(false);

    expect(isConnectionMethod('api_key')).toBe(true);
    expect(isConnectionMethod('local_cli')).toBe(true);
    expect(isConnectionMethod('oauth')).toBe(false);
    expect(isConnectionMethod(null)).toBe(false);
  });

  it('projectPreferenceKey encodes project IDs safely in key suffix', () => {
    expect(projectPreferenceKey('proj-1', 'model')).toBe('seomi_project_proj-1_ai_model');
    expect(projectPreferenceKey('special/id', 'provider')).toBe('seomi_project_special%2Fid_ai_provider');
  });

  it('beginAuthRequest and isLatestAuthRequest track latest request token per kind', () => {
    const token1 = beginAuthRequest('test-flow');
    expect(isLatestAuthRequest('test-flow', token1)).toBe(true);

    const token2 = beginAuthRequest('test-flow');
    expect(isLatestAuthRequest('test-flow', token1)).toBe(false);
    expect(isLatestAuthRequest('test-flow', token2)).toBe(true);

    expect(isLatestAuthRequest('other-flow', token2)).toBe(false);
  });

  it('resolveGlobalAiPreferences falls back to sane defaults', () => {
    const prefs = resolveGlobalAiPreferences();
    expect(isAiProvider(prefs.provider)).toBe(true);
    expect(typeof prefs.model).toBe('string');
    expect(prefs.connectionMethod).toBeDefined();
    expect(isConnectionMethod(prefs.connectionMethod.openai)).toBe(true);
  });
});
