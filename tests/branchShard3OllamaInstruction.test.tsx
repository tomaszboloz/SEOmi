import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OllamaAssistantPanel } from '@/components/AI/ollama/OllamaAssistantPanel';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { createAuditFixture } from './fixtures/audit';
import i18n from '@/i18n';

const mocks = vi.hoisted(() => ({ discover: vi.fn(), createChat: vi.fn() }));
vi.mock('@/services/embeddings/ollamaDiscovery', () => ({ discoverOllama: mocks.discover }));
vi.mock('@/services/embeddings/ollamaChat', () => ({ createOllamaChat: mocks.createChat }));

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: 'shard3-project' });
  useAuditStore.setState({ currentAudit: createAuditFixture() });
  mocks.discover.mockResolvedValue({ version: '0.12.3', models: [{ name: 'llama3.2:latest', model: 'llama3.2:latest', details: { family: 'x' } }] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it('reports unavailable storage when the custom instruction cannot be persisted', async () => {
  render(<OllamaAssistantPanel />);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(i18n.t('ollamaAssistantUi.title')) }));
  await screen.findByText(i18n.t('ollamaAssistantUi.status.ready', { version: '0.12.3' }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'QuotaExceededError'); });
  fireEvent.change(screen.getByLabelText(i18n.t('ollamaAssistantUi.instruction')), { target: { value: 'be brief' } });
  await screen.findByText(i18n.t('runtimeErrors.persistence.workspaceUnavailable'));
  expect((screen.getByLabelText(i18n.t('ollamaAssistantUi.instruction')) as HTMLInputElement).value).toBe('be brief');
});
