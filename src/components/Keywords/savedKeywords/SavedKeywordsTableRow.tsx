import React from 'react';
import { Trash2 } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { SavedKeywordItem } from '@/types';
import { appLocale } from '@/services/localeFormat';

interface SavedKeywordsTableRowProps {
  item: SavedKeywordItem;
  newTagInput: { id: string; tag: string } | null;
  setNewTagInput: (val: { id: string; tag: string } | null) => void;
  onAddTag: (id: string) => void;
  onRemoveTag: (id: string, tag: string) => void;
  onDeleteKeyword: (id: string) => void;
  intentLabel: (intent: string) => string;
  t: TFunction;
}

export const SavedKeywordsTableRow: React.FC<SavedKeywordsTableRowProps> = ({
  item,
  newTagInput,
  setNewTagInput,
  onAddTag,
  onRemoveTag,
  onDeleteKeyword,
  intentLabel,
  t,
}) => {
  const getDiffColor = (diff: number) => {
    if (diff < 30) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (diff < 60) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };
  const getMetricLabel = (value: number | null) => value === null ? '—' : value;

  return (
    <tr className="hover:bg-slate-800/40 transition">
      <td className="px-4 py-3.5 font-medium text-white">
        <span>{item.keyword}</span>
      </td>
      <td className="px-4 py-3.5">
        <div className="flex items-center flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80"
            >
              {tag}
              <button
                onClick={() => onRemoveTag(item.id, tag)}
                className="text-slate-500 hover:text-rose-400"
                title={t('savedKeywordsUi.removeTag')}
              >
                ×
              </button>
            </span>
          ))}
          {newTagInput?.id === item.id ? (
            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={newTagInput.tag}
                onChange={(e) => setNewTagInput({ id: item.id, tag: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAddTag(item.id);
                  if (e.key === 'Escape') setNewTagInput(null);
                }}
                placeholder={t('savedKeywordsUi.newTagPlaceholder')}
                className="w-20 bg-slate-950 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={() => onAddTag(item.id)}
                className="text-[10px] text-emerald-400 px-1 py-0.5"
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              onClick={() => setNewTagInput({ id: item.id, tag: '' })}
              className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded border border-dashed border-slate-700 hover:border-slate-500"
            >
              + {t('savedKeywordsUi.tag')}
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right font-mono text-slate-200">
        {item.search_volume === null ? '—' : item.search_volume.toLocaleString(appLocale())}
      </td>
      <td className="px-4 py-3.5 text-center font-mono">
        <span className={`text-xs px-2 py-0.5 rounded-md border ${item.difficulty === null ? 'border-slate-700 text-slate-500' : getDiffColor(item.difficulty)}`}>
          {getMetricLabel(item.difficulty)}
        </span>
      </td>
      <td className="px-4 py-3.5 text-right font-mono text-slate-300">{item.cpc === null ? '—' : `$${item.cpc.toFixed(2)}`}</td>
      <td className="px-4 py-3.5 text-center text-xs text-slate-400">{intentLabel(item.intent)}</td>
      <td className="px-4 py-3.5 text-right">
        <button
          onClick={() => onDeleteKeyword(item.id)}
          className="p-1.5 rounded hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition"
          title={t('savedKeywordsUi.deleteKeyword')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
