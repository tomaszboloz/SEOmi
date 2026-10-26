import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSE_DELAY_MS, OPEN_DELAY_MS, useHelpTip } from '@/components/Help/useHelpTip';
import { useHelpStore } from '@/components/Help/helpStore';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { useAiSearchPromptsSession } from '@/components/AiVisibility/searchPrompts/useAiSearchPromptsSession';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: unknown) => options ? `${key}:${JSON.stringify(options)}` : key }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));
vi.mock('@/services/export/download', () => ({ downloadText: vi.fn() }));
vi.mock('@/services/clipboard', () => ({ copyText: vi.fn() }));

const oldTools = useToolsStore.getState();
const oldProjects = useProjectStore.getState();
const oldAudit = useAuditStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useHelpStore.setState({ openId: null });
  act(() => {
    useProjectStore.setState({ activeProjectId: 'p' });
    useToolsStore.setState({ savedKeywords: [], crawlRuns: [], selectedCrawlRunId: null, aiPromptComparison: null, aiSearchPrompt: '' } as never);
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  act(() => { useToolsStore.setState(oldTools); useProjectStore.setState(oldProjects); useAuditStore.setState(oldAudit); });
});

describe('remaining hook boundaries', () => {
  it('ignores touch leave without scheduling a close', () => {
    const { result } = renderHook(() => useHelpTip());
    act(() => result.current.trigger.onFocus());
    act(() => result.current.trigger.onPointerLeave({ pointerType: 'touch' } as never));
    act(() => vi.advanceTimersByTime(OPEN_DELAY_MS + CLOSE_DELAY_MS));
    expect(result.current.open).toBe(true);
  });

  it('uses zero fallbacks for malformed optional keyword metrics', () => {
    const item = { id: 'k', keyword: 'seo', search_volume: undefined, difficulty: undefined, cpc: null, intent: null, tags: [], addedAt: 'now' };
    act(() => useToolsStore.setState({ savedKeywords: [item] } as never));
    const { result } = renderHook(() => useSavedKeywordsSession());
    expect(result.current.totalVolume).toBe(0);
    expect(result.current.avgDifficulty).toBe(0);
    expect(result.current.estMonthlyValue).toBe(0);
  });

  it('falls back to an empty evidence array for a sparse result mapping', () => {
    let calls = 0;
    const results = {
      map: (callback: (value: { response_text: string; citations: never[] }, index: number) => unknown) => {
        calls += 1;
        return calls === 1 ? [] : [callback({ response_text: '', citations: [] }, 0)];
      },
    };
    act(() => useToolsStore.setState({ aiPromptComparison: { results } } as never));
    const { result } = renderHook(() => useAiSearchPromptsSession());
    expect(result.current.citationSummaries).toEqual([{ total: 0, matched: 0, contextual: 0, sentenceMatches: 0 }]);
  });
});
