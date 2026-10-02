import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bookmark,
  Trash2,
  Download,
  Search,
  Tag,
  Plus,
  BarChart2,
  TrendingUp,
  DollarSign,
  Layers,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { appLocale } from '@/services/localeFormat';

export const SavedKeywords: React.FC = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const savedKeywords = useToolsStore((s) => s.savedKeywords);
  const removeSavedKeyword = useToolsStore((s) => s.removeSavedKeyword);
  const updateKeywordTags = useToolsStore((s) => s.updateKeywordTags);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);

  const [searchFilter, setSearchFilter] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<{ id: string; tag: string } | null>(null);

  useEffect(() => {
    setSearchFilter('');
    setActiveTagFilter(null);
    setNewTagInput(null);
  }, [activeProjectId]);

  // All unique tags
  const allTags = Array.from(new Set(savedKeywords.flatMap((k) => k.tags || [])));

  // Aggregate metrics
  const totalKeywords = savedKeywords.length;
  const totalVolume = savedKeywords.reduce((acc, k) => acc + k.search_volume, 0);
  const avgDifficulty =
    totalKeywords > 0
      ? Math.round(savedKeywords.reduce((acc, k) => acc + k.difficulty, 0) / totalKeywords)
      : 0;
  const estMonthlyValue = savedKeywords.reduce(
    (acc, k) => acc + (k.search_volume * k.cpc * 0.05), // est. value based on 5% CTR
    0
  );

  const filteredList = savedKeywords.filter((item) => {
    const matchesQuery =
      item.keyword.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesTag = !activeTagFilter || item.tags.includes(activeTagFilter);
    return matchesQuery && matchesTag;
  });

  const intentLabel = (intent: string) => t(`keywordResearchUi.intent.${intent.toLowerCase()}`);

  const exportCSV = () => {
    if (savedKeywords.length === 0) return;
    const headers = [t('savedKeywordsUi.keyword'), t('savedKeywordsUi.searchVolume'), t('savedKeywordsUi.difficulty'), t('savedKeywordsUi.cpc'), t('savedKeywordsUi.intent'), t('savedKeywordsUi.tags'), t('savedKeywordsUi.addedAt')];
    const rows = savedKeywords.map((k) => [
      `"${k.keyword}"`,
      k.search_volume,
      k.difficulty,
      k.cpc,
      k.intent,
      `"${k.tags.join(', ')}"`,
      k.addedAt,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `seomi_saved_keywords_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTag = (id: string) => {
    if (!newTagInput || !newTagInput.tag.trim()) return;
    const target = savedKeywords.find((k) => k.id === id);
    if (!target) return;
    const tagClean = newTagInput.tag.trim();
    if (!target.tags.includes(tagClean)) {
      updateKeywordTags(id, [...target.tags, tagClean]);
    }
    setNewTagInput(null);
  };

  const handleRemoveTag = (id: string, tagToRemove: string) => {
    const target = savedKeywords.find((k) => k.id === id);
    if (!target) return;
    updateKeywordTags(
      id,
      target.tags.filter((t) => t !== tagToRemove)
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('savedKeywordsUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('savedKeywordsUi.provider')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('savedKeywordsUi.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('savedKeywordsUi.description')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('keyword-research')}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('savedKeywordsUi.findMore')}</span>
          </button>

          <button
            onClick={exportCSV}
            disabled={savedKeywords.length === 0}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center space-x-2 transition shadow-md shadow-emerald-950"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('savedKeywordsUi.exportCsv')}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('savedKeywordsUi.savedKeywords')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalKeywords}</div>
          <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.trackedInProject')}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('savedKeywordsUi.aggregateVolume')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalVolume.toLocaleString(appLocale())}</div>
          <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.potentialImpressions')}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('savedKeywordsUi.averageDifficulty')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{avgDifficulty} / 100</div>
          <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.competitiveBarrier')}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <DollarSign className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('savedKeywordsUi.trafficValue')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">${Math.round(estMonthlyValue).toLocaleString(appLocale())}</div>
          <span className="text-[11px] text-slate-500">{t('savedKeywordsUi.organicValue')}</span>
        </div>
      </div>

      {/* Filter and Tag Bar */}
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

        {/* Tag Pills */}
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
            {t('savedKeywordsUi.all', { count: savedKeywords.length })}
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

      {/* Saved Keywords Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Layers className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm">{t('savedKeywordsUi.noMatches')}</p>
            <button
              onClick={() => setActiveTab('keyword-research')}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition inline-block"
            >
              {t('savedKeywordsUi.exploreNow')}
            </button>
          </div>
        ) : (
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
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
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
                              onClick={() => handleRemoveTag(item.id, tag)}
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
                                if (e.key === 'Enter') handleAddTag(item.id);
                                if (e.key === 'Escape') setNewTagInput(null);
                              }}
                              placeholder={t('savedKeywordsUi.newTagPlaceholder')}
                              className="w-20 bg-slate-950 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={() => handleAddTag(item.id)}
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
                      {item.search_volume.toLocaleString(appLocale())}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md border ${
                          item.difficulty < 30
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : item.difficulty < 60
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        {item.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-300">${item.cpc.toFixed(2)}</td>
                    <td className="px-4 py-3.5 text-center text-xs text-slate-400">{intentLabel(item.intent)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => removeSavedKeyword(item.id)}
                        className="p-1.5 rounded hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition"
                        title={t('savedKeywordsUi.deleteKeyword')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
