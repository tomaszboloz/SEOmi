import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OllamaAssistantPanel } from '@/components/AI/ollama/OllamaAssistantPanel';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ discover: vi.fn(), createChat: vi.fn(), chat: vi.fn() }));
vi.mock('@/services/embeddings/ollamaDiscovery', () => ({ discoverOllama: mocks.discover }));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: mocks.createChat }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }));

const model = (name: string) => ({ name, model: name, details: { family: 'fixture' } });
const answer = {
  suggestedTitle: 'Observed local title',
  suggestedDescription: 'Observed local description',
  keyImprovements: ['Keep the primary intent visible'],
  schemaJsonLd: { '@type': 'WebPage', name: 'Observed local title' },
};

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'project-one' });
  useAuditStore.setState({ currentAudit: createAuditFixture() });
  mocks.discover.mockResolvedValue({ version: '0.12.3', models: [model('llama3.2:latest'), model('qwen2.5:7b')] });
  mocks.chat.mockResolvedValue({ model: 'llama3.2:latest', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } });
  mocks.createChat.mockReturnValue(mocks.chat);
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const open = async () => {
  render(<OllamaAssistantPanel />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
  await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: '0.12.3' }));
};

describe('local Ollama assistant panel', () => {
  it('discovers observed models, persists project settings and applies local suggestions', async () => {
    await open();
    expect(screen.getByText('http://127.0.0.1:11434')).toBeTruthy();
    const modelSelect = screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') });
    fireEvent.change(modelSelect, { target: { value: 'llama3.2:latest' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: i18n.t('ollamaAssistantUi.maxOutputTokens') }), { target: { value: '4096' } });
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('ollamaAssistantUi.instruction') }), { target: { value: 'Focus on product intent' } });
    expect(localStorage.getItem('seomi_project_project-one_ollama_assistant_model_v1')).toBe('llama3.2:latest');
    expect(localStorage.getItem('seomi_project_project-one_ollama_assistant_max_output_tokens_v1')).toBe('4096');
    expect(localStorage.getItem('seomi_project_project-one_ollama_assistant_instruction_v1')).toBe('Focus on product intent');

    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await screen.findByText(answer.suggestedTitle);
    expect(mocks.createChat).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2:latest', maxOutputTokens: 4096 });
    expect(mocks.chat).toHaveBeenCalledWith([{ role: 'user', content: expect.stringContaining('Focus on product intent') }]);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('ai.applyTitle') }));
    expect(useAuditStore.getState().currentAudit?.meta_tags.title).toBe(answer.suggestedTitle);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ai.copyJson') }));
  });

  it('reports a real discovery failure without inventing a model or falling back', async () => {
    mocks.discover.mockRejectedValueOnce(new Error('Cannot reach Ollama at http://127.0.0.1:11434'));
    render(<OllamaAssistantPanel />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
    await screen.findByText(i18n.t('ollamaAssistantUi.status.error'));
    expect(screen.getByRole('alert').textContent).toContain('Cannot reach Ollama');
    expect(screen.queryByRole('option', { name: 'llama3.2:latest' })).toBeNull();
    expect((screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('guards missing project, invalid token bounds and oversized prompts', async () => {
    useProjectStore.setState({ activeProjectId: null });
    render(<OllamaAssistantPanel />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toBe(i18n.t('ollamaAssistantUi.errors.projectRequired'));

    useProjectStore.setState({ activeProjectId: 'project-one' });
    cleanup();
    await open();
    fireEvent.change(screen.getByRole('spinbutton', { name: i18n.t('ollamaAssistantUi.maxOutputTokens') }), { target: { value: '4097' } });
    expect(screen.getByRole('alert').textContent).toMatch(/output tokens/);

    useAuditStore.setState({ currentAudit: createAuditFixture({ content_stats: { word_count: 0, reading_time_minutes: 0, text_ratio_percent: 0, top_keywords: Array.from({ length: 700 }, (_, index) => ({ keyword: `keyword-${index}-${'x'.repeat(20)}`, count: index })) } }) });
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'llama3.2:latest' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(i18n.t('ollamaAssistantUi.errors.promptTooLarge')));
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it('ignores stale discovery and generation completions after project ownership changes', async () => {
    let resolveFirst!: (value: { version: string; models: ReturnType<typeof model>[] }) => void;
    const first = new Promise<{ version: string; models: ReturnType<typeof model>[] }>((resolve) => { resolveFirst = resolve; });
    mocks.discover.mockReset().mockReturnValueOnce(first).mockResolvedValue({ version: '0.12.4', models: [model('project-two-model')] });
    render(<OllamaAssistantPanel />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
    act(() => useProjectStore.setState({ activeProjectId: 'project-two' }));
    await screen.findByRole('option', { name: 'project-two-model' });
    act(() => resolveFirst({ version: '0.12.3', models: [model('stale-model')] }));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'stale-model' })).toBeNull());

    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: 'project-two-model' } });
    let resolveChat!: (value: { model: string; text: string; usage: { promptTokens: null; completionTokens: null; totalTokens: null } }) => void;
    mocks.chat.mockReturnValueOnce(new Promise((resolve) => { resolveChat = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    act(() => useProjectStore.setState({ activeProjectId: 'project-three' }));
    act(() => resolveChat({ model: 'project-two-model', text: JSON.stringify(answer), usage: { promptTokens: null, completionTokens: null, totalTokens: null } }));
    await waitFor(() => expect(screen.queryByText(answer.suggestedTitle)).toBeNull());
  });
});
