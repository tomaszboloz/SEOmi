import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/services/tauri', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/tauri')>()),
  invokeTauriCommand: tauri.invoke,
}));

import { createSettingsStore } from '@/stores/settingsStore';
import { useAuthStore } from '@/stores/authStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAppRouting } from '@/hooks/app/useAppRouting';
import { createCrawlPageFixture } from './fixtures/crawl';
import { buildDiagnosisDocuments } from '@/services/topicalDiagnosis/documents';
import { assignRoles } from '@/services/topicalDiagnosis/roles';

describe('settings store stale save failure', () => {
  it('keeps the newer save state when an older save fails afterwards', async () => {
    const store = createSettingsStore();
    let rejectFirst: (error: Error) => void = () => undefined;
    tauri.invoke
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce(undefined);
    const first = store.getState().updateConfig({ default_user_agent: 'agent-one' });
    const second = store.getState().updateConfig({ default_user_agent: 'agent-two' });
    await vi.waitFor(() => expect(tauri.invoke).toHaveBeenCalledTimes(1));
    rejectFirst(new Error('disk full'));
    await Promise.all([first, second]);
    expect(store.getState().configError).toBeNull();
    expect(store.getState().isSaving).toBe(false);
  });
});

describe('auth preferences with a CLI that reports no detail', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      activeProjectId: null,
      cliStatus: { openai: null, claude: { provider: 'claude', command: 'claude', available: true, detail: '' }, gemini: null },
    });
  });

  it('connects with an empty status message when switching to and hydrating a local CLI', () => {
    const store = useAuthStore.getState();
    store.setConnectionMethod('claude', 'local_cli');
    expect(useAuthStore.getState().connectionStatus.claude).toBe('connected');
    expect(useAuthStore.getState().statusMessages.claude).toBe('');
    store.hydrateProject('project-detail');
    expect(useAuthStore.getState().connectionStatus.claude).toBe('connected');
    expect(useAuthStore.getState().statusMessages.claude).toBe('');
  });
});

describe('useAppRouting with an active project id that cannot be encoded in a hash', () => {
  afterEach(() => { window.location.hash = ''; });

  it('selects the overview tab but leaves the invalid hash untouched', () => {
    useProjectStore.setState({ projects: [], activeProjectId: 'not valid id!' });
    useAuditStore.setState({ activeTab: 'links' });
    window.location.hash = '#bogus-hash';
    const { unmount } = renderHook(() => useAppRouting());
    act(() => undefined);
    expect(useAuditStore.getState().activeTab).toBe('overview');
    expect(window.location.hash).toBe('#bogus-hash');
    unmount();
  });
});

describe('topical diagnosis roles', () => {
  it('tolerates pages with an unparsable URL and links resolved from a missing final URL', () => {
    const pages = [
      createCrawlPageFixture({ url: 'https://ex.test/', final_url: '', semantic_links: [{ target_url: '/a/', anchor_text: 'a', is_internal: true }], word_count: 500 }),
      createCrawlPageFixture({ url: 'https://ex.test/a/', final_url: 'https://ex.test/a/', word_count: 500 }),
    ];
    const { documents } = buildDiagnosisDocuments(pages, 'https://ex.test/');
    const roles = assignRoles(documents);
    expect(roles).toHaveLength(documents.length);
    const odd = documents.map((document) => ({ ...document, pages: document.pages.map((page) => ({ ...page, url: 'not a url' })) }));
    expect(assignRoles(odd)).toHaveLength(odd.length);
  });
});
