import React from 'react';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlLimitsConfigProps {
  session: Session;
}

export const CrawlLimitsConfig: React.FC<CrawlLimitsConfigProps> = ({ session }) => {
  const { crawlConfig, setCrawlConfig, t } = session;

  return (
    <>
      <label className="text-xs text-slate-400">
        {t('siteAudit.maxDepth')}{' '}
        <span className="text-slate-600">{t('siteAudit.emptyNoLimit')}</span>
        <input
          type="number"
          min="0"
          max="100"
          value={crawlConfig.maxDepth ?? ''}
          onChange={(event) =>
            setCrawlConfig({
              maxDepth:
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
            })
          }
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
        />
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.maxRedirects')}
        <input
          type="number"
          min="0"
          max="50"
          value={crawlConfig.maxRedirects ?? 10}
          onChange={(event) =>
            setCrawlConfig({ maxRedirects: Number(event.target.value) })
          }
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
        />
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.maxResponse')}
        <input
          type="number"
          min="1"
          max="50"
          value={Math.round(
            (crawlConfig.maxResponseBytes ?? 5_000_000) / 1_000_000,
          )}
          onChange={(event) =>
            setCrawlConfig({
              maxResponseBytes: Number(event.target.value) * 1_000_000,
            })
          }
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
        />
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.maxRunTime')}
        <input
          type="number"
          min="1"
          max="3600"
          value={crawlConfig.maxRunSeconds ?? ''}
          onChange={(event) =>
            setCrawlConfig({
              maxRunSeconds:
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
            })
          }
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
        />
      </label>
    </>
  );
};
