import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FreeSuggestionsPanel } from '@/components/KeywordResearch/freeSuggestions/FreeSuggestionsPanel';

const m = vi.hoisted(() => ({
  project: 'project' as string | null,
  saved: [] as Array<{ keyword: string }>,
  add: vi.fn(),
  importSuggestions: vi.fn(),
  session: { inputQuery: 'seo', setInputQuery: vi.fn(), fetching: false, error: null, result: null, fetchSuggestions: vi.fn(), saveSuggestion: vi.fn(), isSaved: () => false },
}));
vi.mock('react-i18next', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-i18next')>()), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/stores/projectStore', () => ({ useProjectStore: (select: (state: { activeProjectId: string | null }) => unknown) => select({ activeProjectId: m.project }) }));
vi.mock('@/stores/toolsStore', () => ({ useToolsStore: (select: (state: unknown) => unknown) => select({ savedKeywords: m.saved, crawlRuns: [], addSavedKeyword: m.add }) }));
vi.mock('@/components/KeywordResearch/freeSuggestions/useFreeSuggestionsSession', () => ({ useFreeSuggestionsSession: () => m.session }));
vi.mock('@/components/KeywordResearch/freeSuggestions/SuggestionEvidenceSummary', () => ({ SuggestionEvidenceSummary: () => null }));
vi.mock('@/services/freeSuggestions', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/services/freeSuggestions')>()), importSuggestions: m.importSuggestions }));

describe('Free suggestions import guards', () => {
  it('ignores an imported duplicate and returns before importing without a project', () => {
    m.project = 'project'; m.saved = []; m.add.mockReset(); m.importSuggestions.mockReturnValue({ suggestions: ['seo'], importedAt: 'now', source: { kind: 'user-import', sourceUrl: 'https://source.test' } });
    const view = render(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const payload = screen.getByRole('textbox', { name: 'googleSuggestionsUi.importPayload' });
    fireEvent.change(payload, { target: { value: '["seo"]' } });
    fireEvent.click(screen.getByRole('button', { name: 'googleSuggestionsUi.import' }));
    m.saved = [{ keyword: 'seo' }];
    view.rerender(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const save = screen.getByRole('button', { name: 'googleSuggestionsUi.save' }) as HTMLButtonElement;
    save.removeAttribute('disabled');
    save.disabled = false;
    const savePropsKey = Object.keys(save).find((key) => key.startsWith('__reactProps$'));
    (Reflect.get(save, savePropsKey!) as { onClick: () => void }).onClick();
    expect(m.add).not.toHaveBeenCalled();
    m.project = null;
    view.rerender(<FreeSuggestionsPanel query="seo" geo="PL" language="pl" />);
    const nextPayload = screen.getByRole('textbox', { name: 'googleSuggestionsUi.importPayload' });
    fireEvent.change(nextPayload, { target: { value: '["other"]' } });
    const importButton = screen.getByRole('button', { name: 'googleSuggestionsUi.import' }) as HTMLButtonElement;
    importButton.removeAttribute('disabled');
    importButton.disabled = false;
    const importPropsKey = Object.keys(importButton).find((key) => key.startsWith('__reactProps$'));
    (Reflect.get(importButton, importPropsKey!) as { onClick: () => void }).onClick();
    expect(m.importSuggestions).toHaveBeenCalledOnce();
  });
});
