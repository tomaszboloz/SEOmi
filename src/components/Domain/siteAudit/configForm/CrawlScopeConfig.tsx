import React from 'react';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlScopeConfigProps {
  session: Session;
}

export const CrawlScopeConfig: React.FC<CrawlScopeConfigProps> = ({ session }) => {
  const {
    crawlConfig,
    setCrawlConfig,
    setFilterPatterns,
    setAllowedHosts,
    t,
  } = session;

  return (
    <>
      <label className="text-xs text-slate-400">
        {t('siteAudit.includeUrl')}
        <textarea
          value={crawlConfig.includePatterns.join('\n')}
          onChange={(event) =>
            setFilterPatterns('includePatterns', event.target.value)
          }
          placeholder={t('siteAudit.includeUrlPlaceholder')}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.excludeUrl')}
        <textarea
          value={crawlConfig.excludePatterns.join('\n')}
          onChange={(event) =>
            setFilterPatterns('excludePatterns', event.target.value)
          }
          placeholder={t('siteAudit.excludeUrlPlaceholder')}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.allowSubdomains}
          onChange={(event) =>
            setCrawlConfig({ allowSubdomains: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.includeSubdomains')}
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.allowedHosts')}{' '}
        <span className="text-slate-600">
          {t('siteAudit.explicitOnePerLine')}
        </span>
        <textarea
          value={(crawlConfig.allowedHosts || []).join('\n')}
          onChange={(event) => setAllowedHosts(event.target.value)}
          placeholder={t('siteAudit.allowedHostsPlaceholder')}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.scopeDirectory')}{' '}
        <span className="text-slate-600">{t('siteAudit.optional')}</span>
        <input
          value={crawlConfig.scopePath ?? ''}
          onChange={(event) =>
            setCrawlConfig({ scopePath: event.target.value || undefined })
          }
          placeholder={t('siteAudit.scopeDirectoryPlaceholder')}
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>
    </>
  );
};
