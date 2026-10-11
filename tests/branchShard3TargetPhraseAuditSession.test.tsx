import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import * as importedStorage from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { saveImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { useTargetPhraseAuditSession } from '@/components/Results/targetPhraseAudit';
import { useProjectStore } from '@/stores/projectStore';
import * as tauri from '@/services/tauri';
import type { PageAuditData } from '@/types';
import { createAuditFixture } from './fixtures/audit';

const project = { id: 'shard3-target', name: 'Shard 3', rootUrl: 'https://example.test', createdAt: '2026-10-01T00:00:00Z', lastOpenedAt: '2026-10-01T00:00:00Z' };
const audit = (patch: Partial<PageAuditData> = {}): PageAuditData => createAuditFixture({ final_url: 'https://target.example/', meta_tags: { title: 'SEO page' }, headings: { h1_texts: ['SEO'] }, content_stats: { body_text: 'SEO body' }, ...patch } as Partial<PageAuditData>);

afterEach(() => {
  act(() => { useProjectStore.setState({ projects: [], activeProjectId: null }); });
  vi.restoreAllMocks();
});

it('discards a completed inspection when the phrase changes afterwards', async () => {
  useProjectStore.setState({ projects: [project], activeProjectId: project.id });
  saveImportedSerp(project.id, '{"metadata":{"provider":"fixture"},"records":[{"keyword":"SEO","rank":1,"url":"https://result.example/one"}]}', 'json', '2026-10-06T10:00:00Z');
  vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(audit({ url: 'https://result.example/one', final_url: 'https://result.example/one' }));
  const target = audit();
  const session = renderHook(() => useTargetPhraseAuditSession(target));
  act(() => { session.result.current.setPhrase('SEO'); });
  await waitFor(() => expect(session.result.current.canAudit).toBe(true));
  await act(async () => { await session.result.current.auditTopTen(); });
  expect(session.result.current.report?.status).toBe('complete');
  act(() => { session.result.current.setPhrase('Unrelated phrase'); });
  await waitFor(() => expect(session.result.current.report).toBeNull());
  expect(session.result.current.unavailableReason).toBe('phrase-not-found');
});

it('reports no results when the matching snapshot has no ranked rows', () => {
  useProjectStore.setState({ projects: [project], activeProjectId: project.id });
  vi.spyOn(importedStorage, 'readImportedSerp').mockReturnValue({
    importedAt: '2026-10-06T10:00:00Z',
    result: { source: { provider: 'fixture' }, snapshots: [{ keyword: 'SEO', rows: [] }] },
  } as unknown as ReturnType<typeof importedStorage.readImportedSerp>);
  const session = renderHook(() => useTargetPhraseAuditSession(audit()));
  act(() => { session.result.current.setPhrase('SEO'); });
  expect(session.result.current.unavailableReason).toBe('no-results');
  expect(session.result.current.canAudit).toBe(false);
});
