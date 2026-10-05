import { create } from 'zustand';
import { vi } from 'vitest';
import type { AiProvider, PageAuditData } from '@/types';
import type { AiSuggestionResponse } from '@/services/ai';
import { createAuditFixture } from './audit';

export const suggestion: AiSuggestionResponse = {
  suggestedTitle: 'Updated title', suggestedDescription: 'Updated description',
  keyImprovements: ['Improve metadata'], schemaJsonLd: { '@type': 'WebPage', name: 'Example' },
};
export const project = create<{ activeProjectId: string | null }>(() => ({ activeProjectId: 'one' }));
export const setAuditData = vi.fn<(data: PageAuditData) => void>();
export const audit = create<{ currentAudit: PageAuditData | null; setAuditData: typeof setAuditData }>(() => ({ currentAudit: null, setAuditData }));
export const setApiKey = vi.fn<(provider: AiProvider, key: string) => Promise<void>>();
export const generate = vi.fn<(data: PageAuditData, instruction?: string) => Promise<AiSuggestionResponse>>();
export const connected = vi.fn<() => boolean>();
export const setProvider = vi.fn<(provider: AiProvider) => void>();
export const setModel = vi.fn<(model: string) => void>();
export const auth = create(() => ({
  provider: 'openai' as AiProvider, model: 'gpt-4o',
  apiKeys: { openai: 'fixture-key', claude: '', gemini: '' },
  connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' },
  setApiKey, generateSuggestions: generate, isProviderConnected: connected, setProvider, setModel,
}));
export const openModal = vi.fn();
export const closeModal = vi.fn();
export const ui = create(() => ({ openModal, closeModal }));
export const clipboard = vi.fn<(text: string) => Promise<boolean>>();
export function resetAssistant() {
  project.setState({ activeProjectId: 'one' });
  audit.setState({ currentAudit: createAuditFixture() });
  auth.setState({ provider: 'openai', model: 'gpt-4o', apiKeys: { openai: 'fixture-key', claude: '', gemini: '' }, connectionMethod: { openai: 'api_key', claude: 'api_key', gemini: 'api_key' } });
  generate.mockReset().mockResolvedValue(suggestion); connected.mockReset().mockReturnValue(true);
  setApiKey.mockReset().mockResolvedValue(); clipboard.mockReset().mockResolvedValue(true);
  setAuditData.mockReset().mockImplementation(data => audit.setState({ currentAudit: data }));
  setProvider.mockReset().mockImplementation(provider => auth.setState({ provider }));
  setModel.mockReset().mockImplementation(model => auth.setState({ model }));
  openModal.mockReset(); closeModal.mockReset();
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
