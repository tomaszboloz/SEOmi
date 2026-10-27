import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { keyword, tools, resetKeywords } from './fixtures/savedKeywordsSession';

vi.mock('@/stores/toolsStore', async () => ({ useToolsStore: (await import('./fixtures/savedKeywordsSession')).tools }));
vi.mock('@/stores/projectStore', async () => ({ useProjectStore: (await import('./fixtures/savedKeywordsSession')).project }));
vi.mock('@/stores/auditStore', async () => ({ useAuditStore: (await import('./fixtures/savedKeywordsSession')).audit }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }), initReactI18next: { type: '3rdParty', init: vi.fn() } }));
beforeEach(resetKeywords);
afterEach(() => vi.restoreAllMocks());

it('tolerates legacy keywords without tags and values no keyword that lacks cpc or volume', () => {
  const legacy = { ...keyword('legacy', { search_volume: 100, cpc: null, difficulty: 10 }), tags: undefined } as unknown as ReturnType<typeof keyword>;
  const valued = keyword('valued', { search_volume: 200, cpc: 2, difficulty: 30, tags: ['x'] });
  tools.setState({ savedKeywords: [legacy, valued] });
  const { result } = renderHook(useSavedKeywordsSession);
  expect(result.current.allTags).toEqual(['x']);
  expect(result.current.estMonthlyValue).toBeCloseTo(20);
  expect(result.current.totalVolume).toBe(300);
  expect(result.current.filteredList).toHaveLength(2);
});
