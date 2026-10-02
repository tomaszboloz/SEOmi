import React from 'react';
import { Search, Tag } from 'lucide-react';
import type { TFunction } from 'i18next';

interface SavedKeywordsFilterBarProps {
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  activeTagFilter: string | null;
  setActiveTagFilter: (tag: string | null) => void;
  allTags: string[];
  totalSavedKeywords: number;
  t: TFunction;
}

export const SavedKeywordsFilterBar: React.FC<SavedKeywordsFilterBarProps> = ({
  searchFilter,
  setSearchFilter,
  activeTagFilter,
  setActiveTagFilter,
  allTags,
  totalSavedKeywords,
  t,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
      <div className="w-full md:w-80 relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder={t('savedKeywordsUi.searchPlaceholder')}
          className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="flex items-center flex-wrap gap-1.5">
        <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
          <Tag className="w-3 h-3 text-slate-500" /> {t('savedKeywordsUi.tags')}:
        </span>
        <button
          onClick={() => setActiveTagFilter(null)}
          className={`text-xs px-2.5 py-1 rounded-md transition ${
            activeTagFilter === null
              ? 'bg-emerald-500/20 text-emerald-300 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          {t('savedKeywordsUi.all', { count: totalSavedKeywords })}
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
            className={`text-xs px-2.5 py-1 rounded-md transition ${
              activeTagFilter === tag
                ? 'bg-emerald-500/20 text-emerald-300 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};
