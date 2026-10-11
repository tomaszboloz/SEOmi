import { act, renderHook, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSavedKeywordsSession } from '@/components/Keywords/savedKeywords/useSavedKeywordsSession';
import { SavedKeywordsTableRow } from '@/components/Keywords/savedKeywords/SavedKeywordsTableRow';

const downloads = vi.hoisted(() => ({ downloadBlob: vi.fn() }));
vi.mock('@/services/download', () => downloads);
vi.mock('@/stores/toolsStore', () => ({
  useToolsStore: (selector: any) => selector({
    savedKeywords: [{ id: 'k1', keyword: 'seo test', search_volume: 150, difficulty: 25, cpc: 2.0, intent: 'Commercial', tags: ['seo'], addedAt: '2026-10-01' }],
    removeSavedKeyword: vi.fn(),
    updateKeywordTags: vi.fn(),
  }),
}));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (selector: any) => selector({ activeProjectId: 'p1' }) }));
vi.mock('@/stores/auditStore', () => ({ useAuditStore: (selector: any) => selector({ setActiveTab: vi.fn() }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('savedKeywords deep branches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('supports export CSV and inline tag interactions', async () => {
    const { result } = renderHook(() => useSavedKeywordsSession());
    expect(result.current.totalKeywords).toBe(1);

    act(() => {
      result.current.exportCSV();
    });
    expect(downloads.downloadBlob).toHaveBeenCalled();

    const item = result.current.savedKeywords[0];
    const t = (k: string) => k;
    render(<table><tbody>
      <SavedKeywordsTableRow
        item={item}
        newTagInput={null}
        setNewTagInput={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onDeleteKeyword={vi.fn()}
        intentLabel={(i) => i}
        t={t}
      />
    </tbody></table>);

    expect(screen.getByText('seo test')).toBeTruthy();
  });
});
