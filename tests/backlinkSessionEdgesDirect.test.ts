import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBacklinkSession } from '@/components/Domain/backlinkChecker/useBacklinkSession';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';

describe('useBacklinkSession direct contracts', () => {
  beforeEach(() => {
    localStorage.clear();
    useToolsStore.setState({
      backlinkQuery: '',
      isBacklinkLoading: false,
      backlinkError: null,
      backlinkGapCompetitors: [],
      analyzeBacklinks: vi.fn(),
      analyzeBacklinkGap: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes input target from project root when query is empty', () => {
    useProjectStore.setState({
      projects: [{ id: 'p1', name: 'P1', rootUrl: 'https://example.com', createdAt: '2026-10-01', lastOpenedAt: '2026-10-01' }],
      activeProjectId: 'p1',
    });
    const { result } = renderHook(() => useBacklinkSession());
    expect(result.current.inputTarget).toBe('https://example.com');
  });

  it('ignores analyze submit when inputTarget is whitespace', () => {
    const analyzeMock = vi.fn();
    useToolsStore.setState({ analyzeBacklinks: analyzeMock });
    const { result } = renderHook(() => useBacklinkSession());
    act(() => { result.current.setInputTarget('   '); });
    const preventDefault = vi.fn();
    act(() => { result.current.handleAnalyze({ preventDefault } as never); });
    expect(preventDefault).toHaveBeenCalled();
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('triggers analyzeBacklinks and analyzeBacklinkGap', () => {
    const analyzeMock = vi.fn();
    const gapMock = vi.fn();
    useToolsStore.setState({ analyzeBacklinks: analyzeMock, analyzeBacklinkGap: gapMock });
    const { result } = renderHook(() => useBacklinkSession());

    act(() => { result.current.setInputTarget('target.example'); });
    act(() => { result.current.handleAnalyze({ preventDefault: vi.fn() } as never); });
    expect(analyzeMock).toHaveBeenCalledWith('target.example');

    act(() => { result.current.setCompetitorInput('comp1.example\ncomp2.example'); });
    act(() => { result.current.handleAnalyzeGap(); });
    expect(gapMock).toHaveBeenCalledWith('target.example', ['comp1.example', 'comp2.example']);
  });
});
