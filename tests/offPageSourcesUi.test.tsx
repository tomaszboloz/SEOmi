import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { OffPageSourcesWorkspace } from '@/components/Domain/backlinkChecker/OffPageSourcesWorkspace';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import { invokeTauriCommand } from '@/services/tauri/transport';
import { createProvider } from '@/services/embeddings/registry';
import { prePublishContext } from '@/services/prePublish/context';
import { loadOffPageHistory, offPageHistoryKey } from '@/services/offPage/history';
import { mountRun } from './fixtures/prePublishMount';
import { sourceAudit, sourceLink, sourceProfile, sourceVector } from './fixtures/offPageSources';

vi.mock('@/services/tauri/transport', () => ({ invokeTauriCommand: vi.fn(), isTauriEnvironment: () => true }));
vi.mock('@/services/embeddings/registry', () => ({ createProvider: vi.fn() }));
vi.mock('@/services/offPage/sourcePacer', () => ({ waitForSourceSlot: async () => {} }));
const project = { id: 'mount-project', name: 'Acme', rootUrl: 'https://acme.test', createdAt: '', lastOpenedAt: '' };
beforeEach(async () => {
  localStorage.clear();
  const core = prePublishContext('mount-project', [mountRun()]).focus!.coreTopic.label;
  vi.mocked(invokeTauriCommand).mockReset().mockResolvedValue(sourceAudit(`Acme is not about ${core}.`));
  vi.mocked(createProvider).mockReset().mockReturnValue({ id: 'local', model: 'hash', embed: async (texts) => texts.map(() => sourceVector(1, 0)) });
  useProjectStore.setState({ projects: [project], activeProjectId: project.id });
  useToolsStore.setState({ crawlRuns: [mountRun()] });
  await i18n.changeLanguage('en');
});
afterEach(cleanup);
it('preserves empty reports until explicitly requested and shows real scores, provenance and caveats', async () => {
  const storageBefore = { ...localStorage };
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  expect(invokeTauriCommand).not.toHaveBeenCalled();
  expect(createProvider).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Source fetch status')).toBeNull();
  expect(screen.getByText(/Authority scale: 0–100/).textContent).toContain('not a percentage or Google PageRank');
  fireEvent.click(screen.getByRole('button', { name: 'Analyze link sources' }));
  await screen.findByText('Source analysis completed');
  expect(screen.getByText('Scored sources: 1 / 1 selected (not the whole backlink profile).')).toBeTruthy();
  expect(screen.getByText('Text available')).toBeTruthy();
  expect(screen.getByText(/Fetched at: \d{4}-/)).toBeTruthy();
  expect(screen.getByText(/extracted-text offset 0/)).toBeTruthy();
  expect(screen.getByText('Unclear: possible negation')).toBeTruthy();
  expect(screen.getByText(/Co-occurrence is not endorsement\. Homonyms/)).toBeTruthy();
  expect(screen.getByText(/every hit has linked=false/)).toBeTruthy();
  expect(screen.getByText(/not zero backlinks/)).toBeTruthy();
  expect({ ...localStorage }).toEqual({ ...storageBefore, [offPageHistoryKey(project.id)]: expect.any(String) });
  expect(loadOffPageHistory(project.id)[0]).toMatchObject({ sourcesScored: 1, embeddingModelId: 'hash', tbva: { value: 0.8 } });
});
it('selects latest owned completed crawl, not an older or foreign core', async () => {
  const latest = mountRun();
  latest.result.pages.forEach((page) => { page.focus_terms![0] = { term: 'geothermal energy', surface: 'geothermal energy', count: 8, weight: 12 }; });
  useToolsStore.setState({ crawlRuns: [mountRun('mount-project', 'old', '2026-10-01'), latest,
    mountRun('foreign', 'foreign', '2026-10-25')] });
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze link sources' }));
  await screen.findByText('Source analysis completed');
  expect(vi.mocked(createProvider).mock.calls[0][0].corpus![0]).toContain('geothermal');
});
it('keeps TBVA unavailable without a crawl and never invents a core or score', async () => {
  useToolsStore.setState({ crawlRuns: [] });
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze link sources' }));
  await screen.findByText('Source analysis completed');
  expect(screen.getByText(/No usable Core Topic vector/)).toBeTruthy();
  expect(screen.getByText(/Scored sources: 0 \/ 1/)).toBeTruthy();
  expect(createProvider).not.toHaveBeenCalled();
});
it('displays a scored subset as partial when a fetch or authority is missing', async () => {
  vi.mocked(invokeTauriCommand).mockResolvedValueOnce(sourceAudit()).mockRejectedValueOnce('private address blocked');
  render(<OffPageSourcesWorkspace profile={sourceProfile([sourceLink(), sourceLink('https://other.test', NaN)])} />);
  fireEvent.click(screen.getByRole('button', { name: 'Analyze link sources' }));
  await screen.findByText('Source analysis completed');
  expect(screen.getByText(/Scored sources: 1 \/ 2/)).toBeTruthy();
  expect(screen.getByText('Blocked by safe transport')).toBeTruthy();
  expect(screen.getByText(/Some sources lack text/)).toBeTruthy();
});
it('offers only local providers, uses the chosen model and clears evidence when settings change', async () => {
  render(<OffPageSourcesWorkspace profile={sourceProfile()} />);
  fireEvent.change(screen.getByLabelText('Local embedding provider'), { target: { value: 'ollama' } });
  fireEvent.change(screen.getByLabelText('Ollama embedding model'), { target: { value: ' local-model ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze link sources' }));
  await screen.findByText('Source analysis completed');
  expect(createProvider).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ollama', ollamaModel: 'local-model' }));
  fireEvent.change(screen.getByLabelText('Local embedding provider'), { target: { value: 'local' } });
  expect(screen.queryByText('Source analysis completed')).toBeNull();
  act(() => useProjectStore.setState({ activeProjectId: null }));
  expect((screen.getByRole('button', { name: 'Analyze link sources' }) as HTMLButtonElement).disabled).toBe(true);
});
