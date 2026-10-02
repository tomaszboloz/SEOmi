import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AIAssistantModal } from '@/components/AI/AIAssistantModal';
import { SubscriptionModal } from '@/components/Auth/SubscriptionModal';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

const providerState = { openai: '', claude: '', gemini: '' };
const current = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  useUIStore.setState({ activeModal: 'subscription' });
  useAuditStore.setState({ currentAudit: { url: 'https://example.com' } as never });
  useAuthStore.setState({
    provider: 'claude', model: 'claude-opus-5', apiKeys: providerState,
    connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
    connectionStatus: { openai: 'unconfigured', claude: 'unconfigured', gemini: 'unconfigured' },
    statusMessages: providerState, cliStatus: { openai: null, claude: null, gemini: null },
    detectLocalClients: vi.fn(async () => undefined), isProviderConnected: () => true,
  });
});

const optionValues = (select: HTMLElement) => within(select).getAllByRole('option').map(option => option.getAttribute('value'));

describe('Claude model choices', () => {
  it('offers only current Claude models in the AI assistant', () => {
    render(<AIAssistantModal />);
    const select = screen.getByRole('combobox', { name: i18n.t('ai.modelLabel') });
    expect(optionValues(select)).toEqual(current);
    expect(screen.getByRole('option', { name: 'Claude Opus 5' })).toBeTruthy();
  });

  it('offers only available Gemini models in the AI assistant', () => {
    useAuthStore.setState({ provider: 'gemini', model: 'gemini-3.8-flash' });
    render(<AIAssistantModal />);
    expect(optionValues(screen.getByRole('combobox', { name: i18n.t('ai.modelLabel') }))).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview']);
  });

  it('offers only current Claude models in the connection settings', () => {
    render(<SubscriptionModal />);
    const claudeSelects = screen.getAllByRole('combobox', { name: i18n.t('auth.modelLabel') }).filter(select => optionValues(select).some(value => value?.startsWith('claude-')));
    expect(claudeSelects).toHaveLength(1);
    expect(optionValues(claudeSelects[0])).toEqual(current);
  });
});

describe('persisted Claude model migration', () => {
  it('rewrites a retired project model when the project is opened', () => {
    localStorage.setItem('seomi_ai_project_preferences_migrated_v1', '1');
    localStorage.setItem('seomi_project_p1_ai_provider', 'claude');
    localStorage.setItem('seomi_project_p1_ai_model', 'claude-3-7-sonnet-20250219');
    useAuthStore.getState().hydrateProject('p1');
    expect(useAuthStore.getState().model).toBe('claude-sonnet-5');
    expect(localStorage.getItem('seomi_project_p1_ai_model')).toBe('claude-sonnet-5');
  });

  it('rewrites a shut-down Gemini project model', () => {
    localStorage.setItem('seomi_ai_project_preferences_migrated_v1', '1');
    localStorage.setItem('seomi_project_p3_ai_provider', 'gemini');
    localStorage.setItem('seomi_project_p3_ai_model', 'gemini-1.5-pro');
    useAuthStore.getState().hydrateProject('p3');
    expect(useAuthStore.getState().model).toBe('gemini-3.1-pro-preview');
  });

  it('keeps a supported or non-Claude project model', () => {
    localStorage.setItem('seomi_ai_project_preferences_migrated_v1', '1');
    localStorage.setItem('seomi_project_p2_ai_provider', 'openai');
    localStorage.setItem('seomi_project_p2_ai_model', 'gpt-4o-mini');
    useAuthStore.getState().hydrateProject('p2');
    expect(useAuthStore.getState().model).toBe('gpt-4o-mini');
  });
});
