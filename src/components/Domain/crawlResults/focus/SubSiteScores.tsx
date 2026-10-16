import { useTranslation } from 'react-i18next';
import type { SubSite } from '@/services/siteFocus';
import { TONE_BAR, trsTone } from './focusHelpers';

export const SubSiteScores = ({ subSites }: { subSites: SubSite[] }) => {
  const { t } = useTranslation();
  if (subSites.length === 0) return null;
  return (
    <section aria-labelledby="focus-subsites-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-subsites-title" className="text-sm font-semibold text-slate-200">{t('focus.subsites.title')}</h2>
      <ul className="space-y-2">
        {subSites.map((site) => (
          <li key={site.pathPrefix} className="space-y-1 text-xs text-slate-300">
            <p>{t('focus.subsites.item', { label: site.label, prefix: site.pathPrefix, share: site.sharePct })}</p>
            <div className="flex items-center gap-2">
              <span
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={site.score}
                aria-label={t('focus.subsites.score', { score: site.score })}
                className="h-2 flex-1 overflow-hidden rounded bg-slate-800"
              >
                <span className={`block h-2 rounded ${TONE_BAR[trsTone(site.score)]}`} style={{ width: `${site.score}%` }} />
              </span>
              <span className="tabular-nums">{site.score}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
