import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TargetPhraseAuditPanel } from '@/components/Results/targetPhraseAudit';
import { saveImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { useProjectStore } from '@/stores/projectStore';
import * as tauri from '@/services/tauri';
import { createAuditFixture } from './fixtures/audit';
import type { PageAuditData } from '@/types';

const project = { id: 'target-project', name: 'Target project', rootUrl: 'https://example.test', createdAt: '2026-10-01T00:00:00Z', lastOpenedAt: '2026-10-01T00:00:00Z' };
const audit = (): PageAuditData => {
  const base = createAuditFixture();
  return createAuditFixture({
    meta_tags: { ...base.meta_tags, title: 'Target phrase page' },
    headings: { ...base.headings, h1_texts: ['Target phrase'] },
    links: { ...base.links, links: [{ href: 'https://example.test/target', text: 'target phrase', is_internal: true }] },
    content_stats: { ...base.content_stats, word_count: 12, body_text: 'Target phrase is present in the body.' },
  });
};
const importSnapshot = (records = [{ rank: 1, url: 'https://result.example/one' }]) => saveImportedSerp('target-project', JSON.stringify({
  metadata: { provider: 'fixture-provider', countryCode: 'PL', locationCode: 2616, languageCode: 'pl', capturedAt: '2026-10-01T00:00:00Z', retrievedAt: '2026-10-01T00:01:00Z', availability: 'complete' },
  records: records.map((record) => ({ keyword: 'Target phrase', ...record })),
}), 'json', '2026-10-01T00:02:00Z');

const selectProject = () => useProjectStore.setState({ projects: [project], activeProjectId: project.id });

afterEach(() => {
  useProjectStore.setState({ projects: [], activeProjectId: null });
  vi.restoreAllMocks();
});

describe('target phrase audit UI', () => {
  it('matches only the imported phrase and shows truthful source and evidence states', async () => {
    selectProject(); importSnapshot();
    render(<TargetPhraseAuditPanel audit={audit()} />);
    const input = await screen.findByLabelText(i18n.t('targetPhraseAuditUi.phraseLabel'));
    await act(async () => { fireEvent.change(input, { target: { value: ' target   phrase ' } }); });
    expect(await screen.findByText('fixture-provider')).toBeTruthy();
    expect(screen.getByText('https://result.example/one')).toBeTruthy();
    expect(screen.getAllByText(i18n.t('targetPhraseAuditUi.occurrences', { count: 1 })).length).toBe(4);
    expect(screen.getByText((text) => text.includes(`${i18n.t('targetPhraseAuditUi.reportStatus')}: ${i18n.t('targetPhraseAuditUi.reportStatuses.unavailable')}`))).toBeTruthy();
  });

  it('audits supplied TOP10 rows through inspect_url only after the explicit action', async () => {
    selectProject(); importSnapshot();
    const inspected = { ...audit(), url: 'https://result.example/one', final_url: 'https://result.example/one' };
    const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(inspected);
    render(<TargetPhraseAuditPanel audit={audit()} />);
    await act(async () => { fireEvent.change(await screen.findByLabelText(i18n.t('targetPhraseAuditUi.phraseLabel')), { target: { value: 'Target phrase' } }); });
    const button = await screen.findByRole('button', { name: i18n.t('targetPhraseAuditUi.auditTopTen') });
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_url', expect.objectContaining({ url: 'https://result.example/one' })));
    await waitFor(() => expect(screen.getByText((text) => text.includes(`${i18n.t('targetPhraseAuditUi.reportStatus')}: ${i18n.t('targetPhraseAuditUi.reportStatuses.complete')}`))).toBeTruthy());
  });

  it('assigns a distinct request id to every concurrently inspected page', async () => {
    selectProject();
    importSnapshot([
      { rank: 1, url: 'https://result.example/one' },
      { rank: 2, url: 'https://result.example/two' },
      { rank: 3, url: 'https://result.example/three' },
    ]);
    const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(audit());
    render(<TargetPhraseAuditPanel audit={audit()} />);
    await act(async () => { fireEvent.change(await screen.findByLabelText(i18n.t('targetPhraseAuditUi.phraseLabel')), { target: { value: 'Target phrase' } }); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: i18n.t('targetPhraseAuditUi.auditTopTen') })); });
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));
    const calls = invoke.mock.calls.filter(([command]) => command === 'inspect_url');
    const requestIds = calls.map(([, args]) => (args as { requestId: string }).requestId);
    expect(new Set(requestIds).size).toBe(3);
    expect(requestIds.every((requestId) => /^target-phrase-target-project-\d+-\d+$/u.test(requestId))).toBe(true);
  });

  it('ignores an inspection that completes after the project is no longer active', async () => {
    selectProject();
    importSnapshot();
    let resolveInspection!: (value: PageAuditData) => void;
    const response = new Promise<PageAuditData>((resolve) => { resolveInspection = resolve; });
    const invoke = vi.spyOn(tauri, 'invokeTauriCommand').mockReturnValue(response);
    render(<TargetPhraseAuditPanel audit={audit()} />);
    await act(async () => { fireEvent.change(await screen.findByLabelText(i18n.t('targetPhraseAuditUi.phraseLabel')), { target: { value: 'Target phrase' } }); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: i18n.t('targetPhraseAuditUi.auditTopTen') })); });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('inspect_url', expect.anything()));
    act(() => { useProjectStore.setState({ projects: [], activeProjectId: null }); });
    expect(await screen.findByText(i18n.t('targetPhraseAuditUi.unavailable.no-project'))).toBeTruthy();
    resolveInspection(audit());
    await act(async () => { await response; });
    expect(screen.queryByText((text) => text.includes(`${i18n.t('targetPhraseAuditUi.reportStatus')}: ${i18n.t('targetPhraseAuditUi.reportStatuses.complete')}`))).toBeNull();
  });
});
