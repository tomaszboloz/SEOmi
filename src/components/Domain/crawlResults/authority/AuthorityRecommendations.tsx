import { useTranslation } from 'react-i18next';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import { host } from './authorityText';

/** Topical Expansion Engine: prioritised fixes with simulated TAS gain and effort. */
export const AuthorityRecommendations = ({ report }: { report: TopicalAuthorityReport }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="authority-recs-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-recs-title" className="text-sm font-semibold text-slate-200">{t('authority.rec.title')}</h2>
      {report.recommendations.length === 0 ? <p className="text-xs text-slate-500">{t('authority.rec.empty')}</p> : (
        <ol className="space-y-3">
          {report.recommendations.map((rec, index) => (
            <li key={`${rec.code}:${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
              <p className="font-medium text-slate-100">{t(`authority.rec.${rec.code}`, rec.params)}</p>
              <p className="text-emerald-300">{t('authority.rec.delta', { value: rec.deltaTas })} <span className="text-slate-400">· {t('focus.effort', { min: rec.effort.minHours, max: rec.effort.maxHours })}</span></p>
              <p className="text-slate-400">{t(`authority.rec.how.${rec.code}`)}</p>
              {rec.items.length > 0 && <ul className="mt-1 list-disc ps-5">{rec.items.map((item) => <li key={item} className="break-all">{item.startsWith('http') ? host(item) : item}</li>)}</ul>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
