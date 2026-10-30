import { useTranslation } from 'react-i18next';
import type { FocusPage } from '@/services/siteFocus';
import { gscEvidenceFor, uniqueTermsByUrl, type CannibalGroup, type GscQueryPages } from '@/services/topicalAuthority';
import { host } from './authorityText';

export interface CannibalGroupEvidenceProps { group: CannibalGroup; pages: FocusPage[]; language?: string; gsc?: GscQueryPages | null }

/** Search Console evidence and per-URL unique content for one cannibalization candidate group (#59). */
export const CannibalGroupEvidence = ({ group, pages, language, gsc }: CannibalGroupEvidenceProps) => {
  const { t } = useTranslation();
  const evidence = gscEvidenceFor(group, gsc);
  const unique = uniqueTermsByUrl(group, pages, language);
  return (
    <div className="mt-2 space-y-1 text-slate-400">
      {evidence.status === 'unavailable' && <p>{t('authority.cannibal.gsc.unavailable')}</p>}
      {evidence.status === 'no-overlap' && <p>{t('authority.cannibal.gsc.noOverlap')}</p>}
      {evidence.status === 'available' && (
        <>
          <p className={evidence.conflict ? 'text-amber-300' : 'text-emerald-300'} role={evidence.conflict ? 'note' : undefined}>
            {t(evidence.conflict ? 'authority.cannibal.gsc.conflict' : 'authority.cannibal.gsc.agrees', { leader: host(evidence.leader!), canonical: host(group.canonical) })}
          </p>
          <ul className="list-disc ps-5">
            {evidence.queries.map((row) => (
              <li key={row.query} className="break-all">
                {t('authority.cannibal.gsc.query', { query: row.query, pages: row.pages.map((page) => t('authority.cannibal.gsc.page', { url: host(page.url), clicks: page.clicks, impressions: page.impressions })).join('; ') })}
              </li>
            ))}
          </ul>
        </>
      )}
      {evidence.truncated && <p className="text-amber-300">{t('authority.cannibal.gsc.truncated')}</p>}
      <p className="font-medium text-slate-300">{t('authority.cannibal.unique.title')}</p>
      <ul className="list-disc ps-5">
        {group.urls.map((url) => (
          <li key={url} className="break-all">
            {unique[url].length ? t('authority.cannibal.unique.terms', { url: host(url), terms: unique[url].join(', ') }) : t('authority.cannibal.unique.none', { url: host(url) })}
          </li>
        ))}
      </ul>
    </div>
  );
};
