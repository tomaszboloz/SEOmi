import React from 'react';
import type { BacklinkProfileData } from '@/types';
import type { TFunction } from 'i18next';
import { appLocale } from '@/services/localeFormat';

interface BacklinkInboundTableProps {
  profile: BacklinkProfileData;
  isLoading: boolean;
  loadMoreBacklinks: () => void;
  t: TFunction;
}

export const BacklinkInboundTable: React.FC<BacklinkInboundTableProps> = ({
  profile,
  isLoading,
  loadMoreBacklinks,
  t,
}) => {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">
          {t('backlinkUi.returnedBacklinks')}
        </h3>
        <span className="text-xs text-slate-400 font-mono">
          {profile.backlinks.length.toLocaleString(appLocale())} /{' '}
          {profile.total_backlink_rows?.toLocaleString(appLocale()) ??
            t('backlinkUi.unknownCount')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">{t('backlinkUi.sourcePage')}</th>
              <th className="px-4 py-3">{t('backlinkUi.anchorText')}</th>
              <th className="px-4 py-3 text-center">{t('backlinkUi.type')}</th>
              <th className="px-4 py-3 text-center">{t('backlinkUi.dr')}</th>
              <th className="px-4 py-3 text-right">{t('backlinkUi.firstSeen')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {profile.backlinks.map((b, i) => (
              <tr key={i} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 max-w-xs">
                  <div className="font-medium text-slate-200 truncate">
                    {b.source_title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-mono">
                    {b.source_url}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-slate-300 max-w-[200px] truncate">
                  "{b.anchor_text}"
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      b.is_dofollow
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {b.is_dofollow
                      ? t('backlinkUi.dofollow')
                      : t('backlinkUi.nofollow')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono font-bold text-amber-400">
                  {b.domain_rank}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">
                  {b.first_seen}
                </td>
              </tr>
            ))}
            {profile.backlinks.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-xs text-slate-500"
                >
                  {t('backlinkUi.noBacklinks')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {profile.total_backlink_rows !== null &&
        profile.backlinks.length < profile.total_backlink_rows && (
          <div className="flex flex-col gap-2 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] text-slate-500">
              {t('backlinkUi.moreBacklinkNotice')}
            </span>
            <button
              type="button"
              onClick={() => void loadMoreBacklinks()}
              disabled={isLoading}
              className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-emerald-400/50 disabled:opacity-50"
            >
              {isLoading
                ? t('backlinkUi.loading')
                : t('backlinkUi.loadBacklinks')}
            </button>
          </div>
        )}
    </div>
  );
};
