import { beforeEach, describe, expect, it } from 'vitest';
import { currentModel, isHiddenModel, GEMINI_DEFAULT_MODEL } from '@/services/ai/modelCatalog';
import { resolveGlobalAiPreferences } from '@/stores/auth/runtime';
import { useAuthStore } from '@/stores/authStore';

beforeEach(() => localStorage.clear());

describe('retired model IDs', () => {
  it.each([
    ['claude-3-7-sonnet-20250219', 'claude-sonnet-5'], ['claude-3-5-sonnet-20241022', 'claude-sonnet-5'],
    ['claude-3-5-haiku-20241022', 'claude-haiku-4-5'], ['gemini-2.0-flash', GEMINI_DEFAULT_MODEL],
    ['gemini-1.5-pro', 'gemini-3.1-pro-preview'], ['o3-mini', 'gpt-4o-mini'],
  ])('rewrites %s to %s and hides it from selectors', (retired, current) => {
    expect(currentModel(retired)).toBe(current);
    expect(isHiddenModel(retired)).toBe(true);
    expect(isHiddenModel(current)).toBe(false);
  });

  it('keeps current and unknown models', () => {
    for (const model of ['claude-opus-5', 'gpt-4o', 'custom', '']) expect(currentModel(model)).toBe(model);
  });
});

describe('stored AI preferences', () => {
  it('ignores corrupted provider and connection values and uses the provider default model', () => {
    localStorage.setItem('seomi_ai_provider', 'mistral');
    localStorage.setItem('seomi_ai_connection_claude', 'telepathy');
    expect(resolveGlobalAiPreferences()).toMatchObject({ provider: 'openai', model: 'gpt-4o', connectionMethod: { claude: 'api_key' } });
    localStorage.setItem('seomi_ai_provider', 'claude');
    localStorage.setItem('seomi_ai_model', '  ');
    expect(resolveGlobalAiPreferences().model).toBe('claude-opus-5');
  });

  it('migrates a retired saved model and a retired project model when the project opens', () => {
    localStorage.setItem('seomi_ai_provider', 'gemini');
    localStorage.setItem('seomi_ai_model', 'gemini-2.0-flash');
    expect(resolveGlobalAiPreferences().model).toBe(GEMINI_DEFAULT_MODEL);
    localStorage.setItem('seomi_ai_project_preferences_migrated_v1', '1');
    localStorage.setItem('seomi_project_p1_ai_provider', 'claude');
    localStorage.setItem('seomi_project_p1_ai_model', 'claude-3-7-sonnet-20250219');
    useAuthStore.getState().hydrateProject('p1');
    expect(useAuthStore.getState().model).toBe('claude-sonnet-5');
  });
});
