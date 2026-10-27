import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { UpdatesSettingsTab } from '@/components/Settings/settings/UpdatesSettingsTab';
import { KeywordIdeasTable } from '@/components/Keywords/keywordResearch/KeywordIdeasTable';
import { useFreeSerpSession } from '@/components/Keywords/embeddingClustering/useFreeSerpSession';
import { useAuditStore } from '@/stores/auditStore';
import * as freeSerp from '@/services/freeSerp';
import type { KeywordIdea } from '@/types';

vi.mock('@/components/Results/ShowOnPageButton', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/Results/ShowOnPageButton')>();
  return { ShowOnPageButton: (props: Parameters<typeof original.ShowOnPageButton>[0]) => <original.ShowOnPageButton {...props} /> };
});

const plainT = ((key: string) => key) as unknown as TFunction;

beforeEach(async () => { await i18n.changeLanguage('en'); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => { useAuditStore.setState({ showOnlyProblems: false }); });
});

describe('UpdatesSettingsTab', () => {
  it('renders an empty version for an available update without version metadata', () => {
    render(<UpdatesSettingsTab
      updateStatus={{ available: true, installed: false, restart_required: false, current_version: '1.0.0' } as never}
      updateError={null} checkingUpdates={false} installingUpdate={false} handleCheckUpdates={vi.fn()} handleInstallUpdate={vi.fn()} />);
    const expected = i18n.t('legacyUi.settings.updateAvailable', { version: '' }).replace(/\s+/g, ' ').trim();
    expect(screen.getByText((text) => text.replace(/\s+/g, ' ').trim() === expected)).toBeTruthy();
  });
});

describe('KeywordIdeasTable', () => {
  const idea: KeywordIdea = { keyword: 'seo tools', search_volume: 12000, difficulty: 45, cpc: 2.5, competition: 0.65, intent: 'Commercial', trend: [1, 2] };

  it('saves the clicked idea and disables the button for saved keywords', () => {
    const onSave = vi.fn();
    const view = render(<KeywordIdeasTable filteredResults={[idea]} intentFilter="all" setIntentFilter={vi.fn()} savedIds={{}} savedKeywords={[]} onSave={onSave} t={plainT} />);
    const button = screen.getByRole('button', { name: /keywordResearchUi\.save/ });
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledWith(idea);
    view.unmount();
    render(<KeywordIdeasTable filteredResults={[idea]} intentFilter="all" setIntentFilter={vi.fn()} savedIds={{ 'seo tools': true }} savedKeywords={[{ keyword: 'seo tools' }]} onSave={onSave} t={plainT} />);
    expect((screen.getByRole('button', { name: /keywordResearchUi\.saved/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('useFreeSerpSession', () => {
  const options = (patch: Partial<Parameters<typeof useFreeSerpSession>[0]> = {}) => ({
    projectId: 'p1', keyword: 'seo', country: 'PL', language: 'pl', importedAt: null, onImport: vi.fn(), ...patch,
  });

  it.each([[{ projectId: null }], [{ keyword: '   ' }]])('does not fetch without a project or keyword %j', async (patch) => {
    const fetch = vi.spyOn(freeSerp, 'fetchFreeSerp');
    const { result } = renderHook(() => useFreeSerpSession(options(patch)));
    await act(async () => { await result.current.fetchBing(); });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.fetching).toBe(false);
  });

  it('falls back to a generic message when the feed fails without an error text', async () => {
    vi.spyOn(freeSerp, 'fetchFreeSerp').mockResolvedValue({ status: 'blocked', result: null, response: { error: null } } as never);
    const { result } = renderHook(() => useFreeSerpSession(options()));
    await act(async () => { await result.current.fetchBing(); });
    expect(result.current.error).toEqual({ status: 'blocked', message: 'Public feed unavailable' });
  });

  it('stringifies non-Error rejections', async () => {
    vi.spyOn(freeSerp, 'fetchFreeSerp').mockRejectedValue('offline');
    const { result } = renderHook(() => useFreeSerpSession(options()));
    await act(async () => { await result.current.fetchBing(); });
    expect(result.current.error).toEqual({ status: 'error', message: 'offline' });
    expect(result.current.fetching).toBe(false);
  });
});
