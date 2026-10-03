import React from 'react';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { BrandAiVisibilityReport } from '@/types';
import { appLocale } from '@/services/localeFormat';

interface AiBrandOverviewCardsProps {
  report: BrandAiVisibilityReport;
  t: TFunction;
}

export const AiBrandOverviewCards: React.FC<AiBrandOverviewCardsProps> = ({ report, t }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="p-6 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex flex-col justify-between space-y-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-mono">
            {t(report.methodology ? 'aiVisibility.brand.mentionRate' : 'aiResearch.legacyRecognition')}
          </span>
          <div className="text-5xl font-black text-white font-mono mt-2 flex items-baseline gap-2">
            {!report.methodology || report.overall_score === null ? '—' : `${report.overall_score}%`}
            <span className="text-xs font-normal text-emerald-400">
              {t('aiVisibility.brand.sample')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {t(report.methodology ? 'aiResearch.scoreDescription' : 'aiResearch.legacyNote')}
            {report.methodology && (
              <span className="block mt-2">
                {t('aiResearch.shareOfVoice', {
                  value: report.share_of_voice == null ? '—' : `${report.share_of_voice}%`,
                })}
              </span>
            )}
          </p>
        </div>

        <div className="text-[11px] font-mono text-slate-500 pt-3 border-t border-slate-800">
          {t('aiVisibility.brand.lastResearch', {
            date: new Date(report.timestamp).toLocaleString(appLocale()),
          })}
        </div>
      </div>

      <div className="lg:col-span-2 p-6 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>{t('aiVisibility.brand.promptSummary')}</span>
        </h3>

        <div className="space-y-2">
          {report.key_takeaways.map((tip, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
