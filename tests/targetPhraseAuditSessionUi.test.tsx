import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveImportedSerp } from '@/components/Keywords/embeddingClustering/importedSerpStorage';
import { useTargetPhraseAuditSession } from '@/components/Results/targetPhraseAudit';
import { useProjectStore } from '@/stores/projectStore';
import * as tauri from '@/services/tauri';
import * as contentGap from '@/services/targetPhraseAudit/contentGap';
import type { PageAuditData } from '@/types';
import { createAuditFixture } from './fixtures/audit';

const project = { id: 'target-hook-project', name: 'Target hook project', rootUrl: 'https://example.test', createdAt: '2026-10-01T00:00:00Z', lastOpenedAt: '2026-10-01T00:00:00Z' };
const audit = (patch: Partial<PageAuditData> = {}): PageAuditData => createAuditFixture({ final_url: 'https://target.example/', meta_tags: { title: 'SEO page' }, headings: { h1_texts: ['SEO'] }, content_stats: { body_text: 'SEO body' }, ...patch } as Partial<PageAuditData>);
const importHookSnapshot = (metadata = '"provider":"fixture"') => saveImportedSerp(project.id, `{"metadata":{${metadata}},"records":[{"keyword":"SEO","rank":1,"url":"https://result.example/one"}]}`, 'json', '2026-10-06T10:00:00Z');

afterEach(() => {
  useProjectStore.setState({ projects: [], activeProjectId: null });
  vi.restoreAllMocks();
});

describe('target phrase audit session ownership', () => {
  it('keeps project and phrase availability states explicit and guards no-op audits', async () => {
    const invoke = vi.spyOn(tauri, 'invokeTauriCommand');
    const empty = renderHook(() => useTargetPhraseAuditSession(audit()));
    expect(empty.result.current.unavailableReason).toBe('no-project');
    await act(async () => { await empty.result.current.auditTopTen(); });
    expect(invoke).not.toHaveBeenCalled();
    empty.unmount();

    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    const session = renderHook(() => useTargetPhraseAuditSession(audit()));
    expect(session.result.current.unavailableReason).toBe('no-phrase');
    act(() => { session.result.current.setPhrase('SEO'); });
    expect(session.result.current.unavailableReason).toBe('no-import');
    session.unmount();
  });

  it('reports a rejected page inspection and clears it when the phrase context changes', async () => {
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    importHookSnapshot();
    const collect = vi.spyOn(contentGap, 'collectTopTenContentGap').mockRejectedValue(new Error('network'));
    const session = renderHook(() => useTargetPhraseAuditSession(audit()));
    act(() => { session.result.current.setPhrase('SEO'); });
    await waitFor(() => expect(session.result.current.canAudit).toBe(true));
    await act(async () => { await session.result.current.auditTopTen(); });
    expect(session.result.current.error).toBe('network');
    collect.mockRejectedValueOnce('offline');
    await act(async () => { await session.result.current.auditTopTen(); });
    expect(session.result.current.error).toBe('offline');
    act(() => { session.result.current.setPhrase('Other phrase'); });
    await waitFor(() => expect(session.result.current.error).toBeNull());
    act(() => { session.result.current.setPhrase('SEO'); });
    await waitFor(() => expect(session.result.current.canAudit).toBe(true));
    collect.mockRejectedValueOnce('offline-again');
    await act(async () => { await session.result.current.auditTopTen(); });
    expect(session.result.current.error).toBe('offline-again');
    act(() => { useProjectStore.setState({ projects: [], activeProjectId: null }); });
    await waitFor(() => expect(session.result.current.unavailableReason).toBe('no-project'));
    expect(collect).toHaveBeenCalledTimes(3);
  });

  it('resets a completed report when project ownership changes', async () => {
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    importHookSnapshot();
    vi.spyOn(tauri, 'invokeTauriCommand').mockResolvedValue(audit({ url: 'https://result.example/one', final_url: 'https://result.example/one' }));
    const target = audit();
    const session = renderHook(() => useTargetPhraseAuditSession(target));
    act(() => { session.result.current.setPhrase('SEO'); });
    await waitFor(() => expect(session.result.current.canAudit).toBe(true));
    await act(async () => { await session.result.current.auditTopTen(); });
    expect(session.result.current.report?.status).toBe('complete');
    act(() => { useProjectStore.setState({ projects: [], activeProjectId: null }); });
    await waitFor(() => expect(session.result.current.unavailableReason).toBe('no-project'));
    expect(session.result.current.report).toBeNull();
  });

  it('drops a late rejection after a phrase context change while inspecting', async () => {
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    importHookSnapshot();
    let rejectInspection!: (reason?: unknown) => void;
    const pending = new Promise<never>((_, reject) => { rejectInspection = reject; });
    const collect = vi.spyOn(contentGap, 'collectTopTenContentGap').mockReturnValue(pending);
    const session = renderHook(() => useTargetPhraseAuditSession(audit()));
    act(() => { session.result.current.setPhrase('SEO'); });
    await waitFor(() => expect(session.result.current.canAudit).toBe(true));
    let auditRun!: Promise<void>;
    act(() => { auditRun = session.result.current.auditTopTen(); });
    expect(session.result.current.isLoading).toBe(true);
    act(() => { session.result.current.setPhrase('Other phrase'); });
    await waitFor(() => expect(session.result.current.isLoading).toBe(false));
    rejectInspection('late');
    await act(async () => { await auditRun; });
    expect(session.result.current.error).toBeNull();
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it('uses target URL and imported timestamp fallbacks when audit metadata is absent', async () => {
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    importHookSnapshot('"provider":"fixture","countryCode":"PL"');
    const session = renderHook(() => useTargetPhraseAuditSession(audit({ final_url: '', timestamp: '' })));
    act(() => { session.result.current.setPhrase('SEO'); });
    await waitFor(() => expect(session.result.current.report?.retrievedAt).toBe('2026-10-06T10:00:00Z'));
    expect(session.result.current.report?.targetAvailable).toBe(true);
  });

  it('distinguishes a missing imported phrase from a matching snapshot', () => {
    useProjectStore.setState({ projects: [project], activeProjectId: project.id });
    saveImportedSerp(project.id, '{"metadata":{"provider":"fixture"},"records":[{"keyword":"different","rank":1,"url":"https://result.example/one"}]}', 'json', '2026-10-06T10:00:00Z');
    const session = renderHook(() => useTargetPhraseAuditSession(audit()));
    act(() => { session.result.current.setPhrase('SEO'); });
    expect(session.result.current.unavailableReason).toBe('phrase-not-found');
  });
});
