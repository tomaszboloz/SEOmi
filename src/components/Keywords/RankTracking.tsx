import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Globe,
  Trash2,
  Trophy,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useToolsStore } from '@/stores/toolsStore';
import { TrendChart } from '@/components/Charts/TrendChart';
import { dataForSeoLanguage, dataForSeoMarket, dataForSeoMarketLabel, dataForSeoLanguageLabel } from '@/services/dataforseo';
import { DataForSeoLanguagePicker, DataForSeoLocationPicker } from '@/components/DataForSEO/DataForSeoPickers';

/** Keep a rank-tracking draft valid when its provider location changes. */
export const normalizeRankTrackingMarketDraft = (location: string, language: string) => ({
  location,
  language: dataForSeoLanguage(location, language),
});

export const RankTracking: React.FC = () => {
  const { t } = useTranslation();
  const trackedRanks = useToolsStore((s) => s.trackedRanks);
  const isRankLoading = useToolsStore((s) => s.isRankLoading);
  const rankError = useToolsStore((s) => s.rankError);
  const rankTrackingDraft = useToolsStore((s) => s.rankTrackingDraft);
  const setRankTrackingDraft = useToolsStore((s) => s.setRankTrackingDraft);
  const addTrackedRank = useToolsStore((s) => s.addTrackedRank);
  const removeTrackedRank = useToolsStore((s) => s.removeTrackedRank);
  const refreshAllRanks = useToolsStore((s) => s.refreshAllRanks);

  const [showAddModal, setShowAddModal] = useState(false);
  const selectedMarket = dataForSeoMarket(rankTrackingDraft.location);

  const totalTracked = trackedRanks.length;
  const measuredRanks = trackedRanks.filter((r): r is typeof r & { current_rank: number } => r.current_rank !== null);
  const inTop3 = measuredRanks.filter((r) => r.current_rank <= 3).length;
  const inTop10 = measuredRanks.filter((r) => r.current_rank <= 10).length;
  const avgPosition =
    measuredRanks.length > 0
      ? (measuredRanks.reduce((acc, r) => acc + r.current_rank, 0) / measuredRanks.length).toFixed(1)
      : '—';

  const handleAddRank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankTrackingDraft.keyword.trim() || !rankTrackingDraft.domain.trim()) return;
    addTrackedRank(rankTrackingDraft.keyword, rankTrackingDraft.domain, rankTrackingDraft.targetUrl, rankTrackingDraft.location, rankTrackingDraft.language);
    setRankTrackingDraft({ keyword: '' });
    setShowAddModal(false);
  };

  const renderDelta = (delta: number | null) => {
    if (delta === null) return <span className="text-xs text-slate-500">—</span>;
    if (delta > 0) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />+{delta}
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span className="inline-flex items-center text-xs font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />{delta}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-xs font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
        <Minus className="w-3 h-3 mr-0.5" />0
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              {t('rankTrackingUi.badge')}
            </span>
            <span className="text-xs text-slate-400 font-mono">{t('rankTrackingUi.provider')}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">{t('rankTrackingUi.title')}</h1>
          <p className="text-sm text-slate-400">
            {t('rankTrackingUi.description')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => refreshAllRanks()}
            disabled={isRankLoading}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center space-x-2 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRankLoading ? 'animate-spin' : ''}`} />
            <span>{isRankLoading ? t('rankTrackingUi.updating') : t('rankTrackingUi.checkAll')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2 transition shadow-md shadow-emerald-950"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('rankTrackingUi.trackKeyword')}</span>
          </button>
        </div>
      </div>

      {rankError && <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-300">{rankError}</div>}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('rankTrackingUi.keywordsTracked')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{totalTracked}</div>
          <span className="text-[11px] text-slate-500">{t('rankTrackingUi.measured', { count: measuredRanks.length })}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('rankTrackingUi.top3')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{inTop3}</div>
          <span className="text-[11px] text-slate-500">{t('rankTrackingUi.highIntent')}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('rankTrackingUi.top10')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{inTop10}</div>
          <span className="text-[11px] text-slate-500">{t('rankTrackingUi.pageOne')}</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('rankTrackingUi.averagePosition')}</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{avgPosition}</div>
          <span className="text-[11px] text-slate-500">{t('rankTrackingUi.allQueries')}</span>
        </div>
      </div>

      {/* Tracked Ranks Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">{t('rankTrackingUi.keywordQuery')}</th>
                <th className="px-4 py-3">{t('rankTrackingUi.targetPage')}</th>
                <th className="px-4 py-3">{t('rankTrackingUi.location')}</th>
                <th className="px-4 py-3 text-center">{t('rankTrackingUi.currentRank')}</th>
                <th className="px-4 py-3 text-center">{t('rankTrackingUi.change')}</th>
                <th className="px-4 py-3 text-center">{t('rankTrackingUi.bestRank')}</th>
                <th className="px-4 py-3">{t('rankTrackingUi.trajectory')}</th>
                <th className="px-4 py-3 text-right">{t('rankTrackingUi.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {trackedRanks.map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3.5 font-medium text-white">
                    <span className="hover:text-emerald-400 transition cursor-pointer">{r.keyword}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-slate-300 font-mono">{r.domain}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{r.target_url}</div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-400 flex items-center space-x-1 mt-1">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>{dataForSeoMarketLabel(dataForSeoMarket(r.location))} · {dataForSeoLanguageLabel({ code: dataForSeoLanguage(r.location, r.language_code) })}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={`text-sm px-2.5 py-1 rounded-lg font-bold font-mono border ${
                        r.current_rank !== null && r.current_rank <= 3
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : r.current_rank !== null && r.current_rank <= 10
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {r.current_rank !== null ? (r.current_rank > 100 ? t('rankTrackingUi.outsideTop100', 'Outside top 100') : `#${r.current_rank}`) : t('rankTrackingUi.notChecked')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">{renderDelta(r.delta)}</td>
                  <td className="px-4 py-3.5 text-center text-xs font-mono text-slate-400">
                    {r.best_rank !== null ? `#${r.best_rank}` : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="w-28"><TrendChart values={r.history.map((point) => point.rank)} label={t('rankTrackingUi.historyAria', { keyword: r.keyword })} invert /></div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => removeTrackedRank(r.id)}
                      className="p-1.5 rounded hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 transition"
                      title={t('rankTrackingUi.removeTracking')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Tracked Keyword Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>{t('rankTrackingUi.trackNew')}</span>
            </h3>

            <form onSubmit={handleAddRank} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('rankTrackingUi.keywordQuery')}</label>
                <input
                  type="text"
                  required
                  value={rankTrackingDraft.keyword}
                  onChange={(e) => setRankTrackingDraft({ keyword: e.target.value })}
                  placeholder={t('rankTrackingUi.keywordPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('rankTrackingUi.domain')}</label>
                <input
                  type="text"
                  required
                  value={rankTrackingDraft.domain}
                  onChange={(e) => setRankTrackingDraft({ domain: e.target.value })}
                  placeholder={t('rankTrackingUi.domainPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('rankTrackingUi.targetUrlOptional')}</label>
                <input
                  type="text"
                  value={rankTrackingDraft.targetUrl}
                  onChange={(e) => setRankTrackingDraft({ targetUrl: e.target.value })}
                  placeholder={t('rankTrackingUi.targetUrlPlaceholder')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('rankTrackingUi.country')}</label>
                <DataForSeoLocationPicker
                  value={rankTrackingDraft.location}
                  onChange={(location) => setRankTrackingDraft(normalizeRankTrackingMarketDraft(location, rankTrackingDraft.language))}
                  ariaLabel={t('dataforseo.locationLabel')}
                  placeholder={t('dataforseo.locationLabel')}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">{t('rankTrackingUi.language')}</label>
                <DataForSeoLanguagePicker
                  value={rankTrackingDraft.language}
                  market={selectedMarket}
                  onChange={(language) => setRankTrackingDraft({ language })}
                  ariaLabel={t('dataforseo.languageLabel')}
                  placeholder={t('dataforseo.languageLabel')}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  {t('rankTrackingUi.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                >
                  {t('rankTrackingUi.startTracking')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
