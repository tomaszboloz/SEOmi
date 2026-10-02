import React from 'react';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlQueryConfigProps {
  session: Session;
}

export const CrawlQueryConfig: React.FC<CrawlQueryConfigProps> = ({ session }) => {
  const { crawlConfig, setCrawlConfig, setQueryParameterNames, t } = session;

  return (
    <>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.keepQueryStrings}
          onChange={(event) =>
            setCrawlConfig({ keepQueryStrings: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.keepQueryStrings')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.trimTrailingSlash)}
          onChange={(event) =>
            setCrawlConfig({ trimTrailingSlash: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.trimTrailingSlash')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.lowercasePath)}
          onChange={(event) =>
            setCrawlConfig({ lowercasePath: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.lowercasePath')}
      </label>

      {crawlConfig.keepQueryStrings && (
        <>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(crawlConfig.stripTrackingParameters)}
              onChange={(event) =>
                setCrawlConfig({
                  stripTrackingParameters: event.target.checked,
                })
              }
              className="accent-emerald-400"
            />
            {t('siteAudit.stripTracking')}
          </label>

          <label className="text-xs text-slate-400">
            {t('siteAudit.allowedQueryNames')}{' '}
            <span className="text-slate-600">
              {t('siteAudit.optionalCommaLine')}
            </span>
            <textarea
              value={(crawlConfig.allowedQueryParameters || []).join('\n')}
              onChange={(event) =>
                setQueryParameterNames(
                  'allowedQueryParameters',
                  event.target.value,
                )
              }
              placeholder={t('siteAudit.pageExcludePlaceholder')}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>

          <label className="text-xs text-slate-400">
            {t('siteAudit.deniedQueryNames')}{' '}
            <span className="text-slate-600">{t('siteAudit.denyFirst')}</span>
            <textarea
              value={(crawlConfig.deniedQueryParameters || []).join('\n')}
              onChange={(event) =>
                setQueryParameterNames(
                  'deniedQueryParameters',
                  event.target.value,
                )
              }
              placeholder={t('siteAudit.queryExcludePlaceholder')}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
        </>
      )}
    </>
  );
};
