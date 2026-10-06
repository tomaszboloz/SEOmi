import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OllamaAssistantPanel } from '@/components/AI/ollama/OllamaAssistantPanel';
import { useOllamaAssistantSession } from '@/components/AI/ollama/useOllamaAssistantSession';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ discover: vi.fn(), createChat: vi.fn(), chat: vi.fn(), bounded: vi.fn() }));
vi.mock('@/services/embeddings/ollamaDiscovery', () => ({ discoverOllama: mocks.discover }));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: mocks.createChat }));
vi.mock('@/services/embeddings/ollamaTransport', async () => {
  const actual = await vi.importActual<typeof import('@/services/embeddings/ollamaTransport')>('@/services/embeddings/ollamaTransport');
  mocks.bounded.mockImplementation(actual.boundedOllamaInteger);
  return { ...actual, boundedOllamaInteger: mocks.bounded };
});

const model = { name: 'llama3.2:latest', model: 'llama3.2:latest', details: { family: 'fixture' } };
const discovery = { version: '0.12.3', models: [model] };
const SessionProbe = () => {
  const session = useOllamaAssistantSession(true);
  return <><button type="button" onClick={() => void session.handleGenerate()}>probe-generate</button><button type="button" onClick={() => session.handleMaxOutputTokensChange('1')}>probe-token</button>{session.error && <div role="alert">{session.error}</div>}</>;
};

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'error-project' });
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

describe('Ollama error ownership branches', () => {
  it('formats an Error chat failure without exposing the response', async () => {
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: model.name } });
    mocks.chat.mockRejectedValueOnce(new Error('local request failed'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('local request failed'));
  });

  it('ignores a stale generation rejection after the instruction changes', async () => {
    let rejectChat!: (cause: unknown) => void;
    await open();
    fireEvent.change(screen.getByRole('combobox', { name: i18n.t('ollamaAssistantUi.model') }), { target: { value: model.name } });
    mocks.chat.mockReturnValueOnce(new Promise((_, reject) => { rejectChat = reject; }));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('ollamaAssistantUi.generate') }));
    await waitFor(() => expect(mocks.chat).toHaveBeenCalled());
    fireEvent.change(screen.getByRole('textbox', { name: i18n.t('ollamaAssistantUi.instruction') }), { target: { value: 'new owner' } });
    act(() => rejectChat('late generation failure'));
    await waitFor(() => expect(screen.queryByText('late generation failure')).toBeNull());
  });

  it('reports an opaque token-bound failure without accepting the value', async () => {
    mocks.bounded.mockImplementationOnce(() => { throw 'opaque token failure'; });
    render(<SessionProbe />);
    await waitFor(() => expect(mocks.discover).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'probe-token' }));
    await screen.findByText('opaque token failure');
  });
});
