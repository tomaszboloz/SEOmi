import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SiteFocusReport } from '@/services/siteFocus';
import { codeDetail, codeText, codeTitle, formatPct } from './focusText';

export const SiteRecommendations = ({ report }: { report: SiteFocusReport }) => {
  const { t } = useTranslation();
  const { recommendations, gaps, linkSuggestions } = report;
  return (
    <section aria-labelledby="focus-recs-title" className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-recs-title" className="text-sm font-semibold text-slate-200">{t('focus.site.title')}</h2>
      {recommendations.length === 0 ? <p className="text-xs text-slate-500">{t('focus.site.empty')}</p> : (
        <ol className="space-y-3">
          {recommendations.map((rec) => (
            <li key={rec.code} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              <p className="font-medium text-slate-100">{codeTitle(t, 'recommendation', rec.code, rec.params)}</p>
              <p>{codeDetail(t, 'recommendation', rec.code, rec.params)}</p>
              <p className="flex items-center gap-1 text-emerald-300">
                {rec.deltaScore > 0 ? t('focus.site.delta', { value: formatPct(rec.deltaScore) }) : t('focus.site.deltaZero')}
                <HelpTip id="focus.deltaScore" />
                <span className="text-slate-400">· {t('focus.effort', { min: rec.effort.minHours, max: rec.effort.maxHours })}</span>
              </p>
              {rec.urls.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-slate-400">{t('focus.site.pagesList')} ({rec.urls.length})</summary>
                  <ul className="mt-1 space-y-0.5 break-all font-mono text-[11px]">{rec.urls.map((url) => <li key={url}>{url}</li>)}</ul>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-slate-300">{t('focus.site.gaps')}</h3>
        {gaps.length === 0 ? <p className="text-xs text-slate-500">{t('focus.site.gapsEmpty')}</p> : (
          <ul className="list-disc space-y-1 ps-5 text-xs text-slate-300">
            {gaps.map((gap) => (
              <li key={`${gap.code}:${gap.label}`}>
                {codeText(t, 'gap', gap.code, { label: gap.label, terms: gap.terms.join(', '), coveragePct: formatPct(gap.coveragePct), pagesCovering: gap.pagesCovering })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-slate-300">{t('focus.site.links')}</h3>
        {linkSuggestions.length === 0 ? <p className="text-xs text-slate-500">{t('focus.site.linksEmpty')}</p> : (
          <ul className="list-disc space-y-1 ps-5 text-xs text-slate-300">
            {linkSuggestions.map((link) => (
              <li key={`${link.fromUrl}>${link.toUrl}`} className="break-all">
                {codeText(t, 'link', link.code, { from: link.fromUrl, to: link.toUrl, anchors: link.anchors.join(', ') })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
