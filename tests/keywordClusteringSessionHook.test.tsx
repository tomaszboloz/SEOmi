import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeywordClusteringSession } from '@/components/Keywords/keywordClustering/useKeywordClusteringSession';
import { MAX_KEYWORDS, sessionKey } from '@/components/Keywords/keywordClustering/keywordClusteringTypes';
import { useProjectStore } from '@/stores/projectStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';

const { serpMock } = vi.hoisted(() => ({ serpMock: vi.fn() }));
vi.mock('@/services/dataforseo', async (orig) => ({
  ...(await orig<typeof import('@/services/dataforseo')>()),
  DataForSEOClient: vi.fn().mockImplementation(function Client() {
    return { getSerpCompetitors: serpMock };
  }),
}));

const t = i18n.t.bind(i18n);
const setup = () => renderHook(() => useKeywordClusteringSession(t));
const creds = { login: 'l', password: 'p' };

describe('useKeywordClusteringSession state helpers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    serpMock.mockReset();
    useProjectStore.setState({ activeProjectId: 'p1' });
    useSettingsStore.setState({ dataForSeoCredentials: creds });
  });

  it('parses keywords from input and persists session patches per project', () => {
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'a\nB\nb\n\n c ' }));
    expect(result.current.keywords).toEqual(['a', 'B', 'c']);
    expect(JSON.parse(localStorage.getItem(sessionKey('p1'))!).input).toBe('a\nB\nb\n\n c ');
  });

  it('does not persist when no project is active', () => {
    useProjectStore.setState({ activeProjectId: null });
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'x\ny' }));
    expect(result.current.session.input).toBe('x\ny');
    expect(localStorage.length).toBe(0);
  });

  it('appends only new, trimmed, case-insensitively unique keywords', () => {
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'Alpha' }));
    act(() => result.current.appendKeywords(['alpha', ' beta ', '', 'BETA', 'gamma']));
    expect(result.current.session.input).toBe('Alpha\nbeta\ngamma');
  });

  it('caps appended keywords at the maximum', () => {
    const { result } = setup();
    const many = Array.from({ length: MAX_KEYWORDS + 5 }, (_, i) => `kw${i}`);
    act(() => result.current.appendKeywords(many));
    expect(result.current.keywords).toHaveLength(MAX_KEYWORDS);
  });

  it('changeCountry updates tools store, drops the stale result and keeps a valid language', () => {
    const { result } = setup();
    act(() => result.current.changeCountry('DE'));
    expect(useToolsStore.getState().keywordCountry).toBe('DE');
    expect(result.current.session.country).toBe('DE');
    expect(result.current.session.result).toBeNull();
    expect(result.current.session.language).toBeTruthy();
  });

  it('reloads the saved session and clears error when the project changes', async () => {
    localStorage.setItem(sessionKey('p2'), JSON.stringify({ input: 'saved one\nsaved two' }));
    const { result } = setup();
    await act(async () => result.current.runClustering());
    expect(result.current.error).toBe(t('keywordClusteringUi.minimumKeywordsError'));
    act(() => useProjectStore.setState({ activeProjectId: 'p2' }));
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBe(0);
    expect(result.current.session.input).toBe('saved one\nsaved two');
  });

  it.each([
    ['no project', () => useProjectStore.setState({ activeProjectId: null }), 'x\ny', 'selectProjectError'],
    ['one keyword', () => undefined, 'x', 'minimumKeywordsError'],
    ['too many', () => undefined, Array.from({ length: MAX_KEYWORDS + 1 }, (_, i) => `k${i}`).join('\n'), 'maximumKeywordsError'],
    ['no credentials', () => useSettingsStore.setState({ dataForSeoCredentials: { login: '', password: '' } }), 'x\ny', 'credentialsError'],
  ])('rejects the run with %s', async (_n, arrange, input, key) => {
    arrange();
    const { result } = setup();
    act(() => result.current.updateSession({ input }));
    await act(async () => result.current.runClustering());
    expect(result.current.error).toContain(t(`keywordClusteringUi.${key}`, { count: MAX_KEYWORDS }));
    expect(serpMock).not.toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it('reports a missing market without calling the API', async () => {
    const { result } = setup();
    act(() => result.current.updateSession({ input: 'x\ny', country: 'ZZ' }));
    await act(async () => result.current.runClustering());
    expect(result.current.error).toBe(t('runtimeErrors.dataforseo.marketRequired'));
    expect(serpMock).not.toHaveBeenCalled();
  });
});
