import React from 'react';
import { Layers } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SavedKeywordItem } from '@/types';
import { SavedKeywordsTableRow } from './SavedKeywordsTableRow';

interface SavedKeywordsTableProps {
  filteredList: SavedKeywordItem[];
  newTagInput: { id: string; tag: string } | null;
  setNewTagInput: (val: { id: string; tag: string } | null) => void;
  onAddTag: (id: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteKeyword: (id: string) => void;
  onExploreNow: () => void;
  t: TFunction;
}

export const SavedKeywordsTable: React.FC<SavedKeywordsTableProps> = ({
  filteredList,
  newTagInput,
  setNewTagInput,
  onAddTag,
  onRemoveTag,
  onDeleteKeyword,
  onExploreNow,
  t,
}) => {
  const intentLabel = (intent: string) =>
    t(`keywordResearchUi.intent.${intent.toLowerCase()}`);

  if (filteredList.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md p-12 text-center text-slate-400 space-y-3">
        <Layers className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-sm">{t('savedKeywordsUi.noMatches')}</p>
        <button
          onClick={onExploreNow}
          className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition inline-block"
        >
          {t('savedKeywordsUi.exploreNow')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">{t('savedKeywordsUi.keywordQuery')}</th>
              <th className="px-4 py-3">{t('savedKeywordsUi.tags')}</th>
              <th className="px-4 py-3 text-right">{t('savedKeywordsUi.volume')}</th>
              <th className="px-4 py-3 text-center">{t('savedKeywordsUi.difficulty')}</th>
              <th className="px-4 py-3 text-right">{t('savedKeywordsUi.cpc')}</th>
              <th className="px-4 py-3 text-center">{t('savedKeywordsUi.intent')}</th>
              <th className="px-4 py-3 text-right">{t('savedKeywordsUi.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredList.map((item) => (
              <SavedKeywordsTableRow
                key={item.id}
                item={item}
                newTagInput={newTagInput}
                setNewTagInput={setNewTagInput}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
                onDeleteKeyword={onDeleteKeyword}
                intentLabel={intentLabel}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
