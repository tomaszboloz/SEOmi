import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OllamaAssistantPanel } from '@/components/AI/ollama/OllamaAssistantPanel';
import {
  OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS,
  readOllamaAssistantMaxTokens,
  readOllamaAssistantModel,
  saveOllamaAssistantMaxTokens,
  saveOllamaAssistantModel,
} from '@/components/AI/ollama/ollamaAssistantStorage';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ discover: vi.fn(), createChat: vi.fn(), chat: vi.fn() }));
vi.mock('@/services/embeddings/ollamaDiscovery', () => ({ discoverOllama: mocks.discover }));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: mocks.createChat }));

const model = (name: string) => ({ name, model: name, details: { family: 'fixture' } });
const answer = { suggestedTitle: 'Stale title', suggestedDescription: 'Stale description', keyImprovements: [], schemaJsonLd: {} };
const discovered = { version: '0.12.3', models: [model('llama3.2:latest'), model('qwen2.5:7b')] };

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'owner-project' });
  useAuditStore.setState({ currentAudit: createAuditFixture() });
  mocks.discover.mockResolvedValue(discovered);
  mocks.createChat.mockReturnValue(mocks.chat);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

const open = async () => {
  render(<OllamaAssistantPanel />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
  await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: discovered.version }));
};

const pendingAnswer = () => {
  let resolve!: (value: { model: string; text: string; usage: { promptTokens: null; completionTokens: null; totalTokens: null } }) => void;
  mocks.chat.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
  return resolve;
};

describe('Ollama ownership boundaries', () => {
  it('ignores a pending answer after the instruction owner changes', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    const resolve = pendingAnswer();
    await waitFor(() => expect(mocks.chat).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('ollamaAssistantUi.instruction') }), { target: { value: 'new owner' } });
    act(() => resolve({ model: 'llama3.2:latest', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } }));
    await waitFor(() => expect(screen.queryByText(answer.suggestedTitle)).toBeNull());
  });

  it('ignores a pending answer after the selected model changes', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    const resolve = pendingAnswer();
    await waitFor(() => expect(mocks.chat).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'qwen2.5:7b' } });
    act(() => resolve({ model: 'llama3.2:latest', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } }));
    await waitFor(() => expect(screen.queryByText(answer.suggestedTitle)).toBeNull());
  });

  it('ignores a pending answer after the audited page changes', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    const resolve = pendingAnswer();
    await waitFor(() => expect(mocks.chat).toHaveBeenCalled());
    act(() => useAuditStore.setState({ currentAudit: createAuditFixture({ timestamp: '2026-10-02T00:00:00Z' }) }));
    act(() => resolve({ model: 'llama3.2:latest', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } }));
    await waitFor(() => expect(screen.queryByText(answer.suggestedTitle)).toBeNull());
  });

  it('cancels hidden discovery and retries when the panel is reopened', async () => {
    let resolveFirst!: (value: typeof discovered) => void;
    const first = new Promise<typeof discovered>((resolve) => { resolveFirst = resolve; });
    mocks.discover.mockReset().mockReturnValueOnce(first).mockResolvedValueOnce({ version: '0.12.4', models: [model('reopened-model')] });
    render(<OllamaAssistantPanel />);
    const toggle = screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) });
    fireEvent.click(toggle);
    await screen.findByText(i18n.t('ollamaAssistantUi.status.loading'));
    fireEvent.click(toggle);
    act(() => resolveFirst({ version: '0.12.3', models: [model('stale-model')] }));
    fireEvent.click(toggle);
    await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: '0.12.4' }));
    expect(screen.queryByRole('option', { name: 'stale-model' })).toBeNull();
    expect(screen.getByRole('option', { name: 'reopened-model' })).toBeTruthy();
    expect(mocks.discover).toHaveBeenCalledTimes(2);
  });

  it('reports when local settings cannot be persisted', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'QuotaExceededError'); });
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(i18n.t('runtimeErrors.persistence.workspaceUnavailable')));
    fireEvent.change(screen.getByRole('spinbutton', { name: i18n.t('ollamaAssistantUi.maxOutputTokens') }), { target: { value: '4096' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(i18n.t('runtimeErrors.persistence.workspaceUnavailable')));
  });

  it('does not claim settings were saved without a project', () => {
    expect(readOllamaAssistantModel(null)).toBe('');
    expect(readOllamaAssistantMaxTokens(null)).toBe(OLLAMA_ASSISTANT_DEFAULT_MAX_OUTPUT_TOKENS);
    expect(saveOllamaAssistantModel(null, 'model')).toBe(false);
    expect(saveOllamaAssistantMaxTokens(null, 1)).toBe(false);
  });
});
