import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OllamaAssistantPanel } from '@/components/AI/ollama/OllamaAssistantPanel';
import { useOllamaAssistantSession } from '@/components/AI/ollama/useOllamaAssistantSession';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ discover: vi.fn(), createChat: vi.fn(), chat: vi.fn() }));
vi.mock('@/services/embeddings/ollamaDiscovery', () => ({ discoverOllama: mocks.discover }));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: mocks.createChat }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn().mockRejectedValue(new Error('copy failed')) }));

const model = (name: string) => ({ name, model: name, details: { family: 'fixture' } });
const answer = { suggestedTitle: 'Observed edge title', suggestedDescription: 'Observed edge description', keyImprovements: [], schemaJsonLd: {} };
const discovery = { version: '0.12.3', models: [model('llama3.2:latest'), model('qwen2.5:7b')] };
const SessionProbe = () => {
  const session = useOllamaAssistantSession(true);
  return <><button type="button" onClick={() => void session.handleGenerate()}>probe-generate</button><button type="button" onClick={() => session.handleMaxOutputTokensChange('1.5')}>probe-token</button><button type="button" onClick={() => session.handleModelChange('missing')}>probe-model</button>{session.error && <div role="alert">{session.error}</div>}</>;
};

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'edge-project' });
  useAuditStore.setState({ currentAudit: createAuditFixture() });
  mocks.discover.mockResolvedValue(discovery);
  mocks.createChat.mockReturnValue(mocks.chat);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

const open = async () => {
  render(<OllamaAssistantPanel />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
  await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: discovery.version }));
};

describe('Ollama session edge branches', () => {
  it('loads valid project settings and supports explicit refresh', async () => {
    localStorage.setItem('seomi_project_edge-project_ollama_assistant_model_v1', 'qwen2.5:7b');
    localStorage.setItem('seomi_project_edge-project_ollama_assistant_max_output_tokens_v1', '123');
    await open();
    expect((screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }) as HTMLSelectElement).value).toBe('qwen2.5:7b');
    expect((screen.getByRole('spinbutton', { name: i18n.t('ollamaAssistantUi.maxOutputTokens') }) as HTMLInputElement).value).toBe('123');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.refresh') }));
    await waitFor(() => expect(mocks.discover).toHaveBeenCalledTimes(2));
  });

  it('uses an honest placeholder when Ollama reports no version text', async () => {
    mocks.discover.mockResolvedValueOnce({ version: '', models: discovery.models });
    render(<OllamaAssistantPanel />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
    await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: '?' }));
  });

  it('reports missing audit and selected model before dispatching chat', async () => {
    render(<SessionProbe />);
    await waitFor(() => expect(mocks.discover).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'probe-generate' }));
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('ollamaAssistantUi.errors.modelRequired'));
    act(() => useAuditStore.setState({ currentAudit: null }));
    fireEvent.click(screen.getByRole('button', { name: 'probe-generate' }));
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('ollamaAssistantUi.errors.auditRequired'));
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it('guards a missing project and invalid direct control values', async () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<SessionProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'probe-generate' }));
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('ollamaAssistantUi.errors.projectRequired'));
    cleanup();
    useProjectStore.setState({ activeProjectId: 'edge-project' });
    render(<SessionProbe />);
    await waitFor(() => expect(mocks.discover).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'probe-token' }));
    fireEvent.click(screen.getByRole('button', { name: 'probe-model' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('surfaces a chat failure without exposing a fabricated suggestion', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    mocks.chat.mockRejectedValueOnce('opaque local failure');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('opaque local failure'));
    expect(screen.queryByText(answer.suggestedTitle)).toBeNull();
  });

  it('reports an opaque discovery failure without inventing models', async () => {
    mocks.discover.mockReset().mockRejectedValueOnce('opaque discovery failure');
    render(<OllamaAssistantPanel />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
    await screen.findByText(i18n.t('ollamaAssistantUi.status.error'));
    expect(screen.getByRole('alert').textContent).toBe('opaque discovery failure');
    expect(screen.queryByRole('option', { name: 'llama3.2:latest' })).toBeNull();
  });

  it('reports copy failures from an observed local suggestion', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    mocks.chat.mockResolvedValueOnce({ model: 'llama3.2:latest', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await screen.findByText(answer.suggestedTitle);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ai.copyJson') }));
    await screen.findByText('copy failed');
  });

  it('ignores a stale discovery rejection after the panel is hidden', async () => {
    let rejectFirst!: (cause: unknown) => void;
    const first = new Promise<typeof discovery>((_, reject) => { rejectFirst = reject; });
    mocks.discover.mockReset().mockReturnValueOnce(first).mockResolvedValueOnce(discovery);
    render(<OllamaAssistantPanel />);
    const toggle = screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) });
    fireEvent.click(toggle);
    await screen.findByText(i18n.t('ollamaAssistantUi.status.loading'));
    fireEvent.click(toggle);
    act(() => rejectFirst('late discovery failure'));
    fireEvent.click(toggle);
    await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: discovery.version }));
    expect(screen.queryByText('late discovery failure')).toBeNull();
  });

  it('renders a disabled generate action when the current audit is absent', async () => {
    useAuditStore.setState({ currentAudit: null });
    await open();
    expect((screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('retains the selected runtime model when persistence fails and refreshes', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'QuotaExceededError'); });
    await open();
    const select = screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') });
    fireEvent.change(select, { target: { value: 'llama3.2:latest' } });
    await screen.findByText(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.refresh') }));
    await waitFor(() => expect(mocks.discover).toHaveBeenCalledTimes(2));
    expect((select as HTMLSelectElement).value).toBe('llama3.2:latest');
  });
});
