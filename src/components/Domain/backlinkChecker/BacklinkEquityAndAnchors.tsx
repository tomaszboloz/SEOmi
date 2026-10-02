import React from 'react';
import { BarChart2, Sparkles } from 'lucide-react';
import type { BacklinkProfileData } from '@/types';
import type { TFunction } from 'i18next';

interface BacklinkEquityAndAnchorsProps {
  profile: BacklinkProfileData;
  isLoading: boolean;
  loadMoreBacklinkAnchors: () => void;
  t: TFunction;
}

export const BacklinkEquityAndAnchors: React.FC<BacklinkEquityAndAnchorsProps> = ({
  profile,
  isLoading,
  loadMoreBacklinkAnchors,
  t,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Link Equity Quality Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-400" />
          <span>{t('backlinkUi.equityRatio')}</span>
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-emerald-400">
              {t('backlinkUi.dofollow')}:{' '}
              {profile.dofollow_ratio === null
                ? '—'
                : `${profile.dofollow_ratio}%`}
            </span>
            <span className="text-slate-400">
              {t('backlinkUi.nofollow')}:{' '}
              {profile.dofollow_ratio === null
                ? '—'
                : `${(100 - profile.dofollow_ratio).toFixed(1)}%`}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${profile.dofollow_ratio ?? 0}%` }}
            />
            <div
              className="h-full bg-slate-600 transition-all"
              style={{ width: `${100 - (profile.dofollow_ratio ?? 0)}%` }}
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
          {t('backlinkUi.equityNotice')}
        </div>
      </div>

      {/* Anchor Distribution */}
      <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{t('backlinkUi.anchorProfile')}</span>
        </h3>
        <p className="text-[11px] text-slate-500">
          {t('backlinkUi.anchorSummary', {
            count: profile.anchors.length,
            total:
              profile.total_anchor_rows?.toLocaleString() ??
              t('backlinkUi.unknownCount'),
          })}
        </p>
        <p className="text-[11px] text-slate-500">{t('backlinkUi.anchorNotice')}</p>

        <div className="space-y-2.5">
          {profile.anchors.map((anc, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-200 truncate max-w-sm font-mono">
                  {anc.anchor}
                </span>
                <span className="text-slate-400 font-mono">
                  {t('backlinkUi.anchorCount', {
                    count: anc.count,
                    percentage:
                      anc.percentage === null ? '—' : `${anc.percentage}%`,
                  })}
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${anc.percentage ?? 0}%` }}
                />
              </div>
            </div>
          ))}
          {profile.anchors.length === 0 && (
            <p className="text-xs text-slate-500">{t('backlinkUi.noAnchors')}</p>
          )}
        </div>
        {profile.total_anchor_rows !== null &&
          profile.anchors.length < profile.total_anchor_rows && (
            <button
              type="button"
              onClick={() => void loadMoreBacklinkAnchors()}
              disabled={isLoading}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50"
            >
              {isLoading ? t('backlinkUi.loading') : t('backlinkUi.loadAnchors')}
            </button>
          )}
      </div>
    </div>
  );
};
