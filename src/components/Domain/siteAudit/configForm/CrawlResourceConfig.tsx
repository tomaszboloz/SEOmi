import React from 'react';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlResourceConfigProps {
  session: Session;
}

export const CrawlResourceConfig: React.FC<CrawlResourceConfigProps> = ({ session }) => {
  const { crawlConfig, importSeedUrls, seedImportRejected, setCrawlConfig, t } = session;

  const hasResourceCrawl =
    crawlConfig.crawlImages ||
    crawlConfig.crawlStylesheets ||
    crawlConfig.crawlScripts ||
    crawlConfig.crawlOtherResources;

  return (
    <>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.crawlImages)}
          onChange={(event) =>
            setCrawlConfig({ crawlImages: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.crawlImages')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.crawlStylesheets)}
          onChange={(event) =>
            setCrawlConfig({ crawlStylesheets: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.crawlStylesheets')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.crawlScripts)}
          onChange={(event) =>
            setCrawlConfig({ crawlScripts: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.crawlScripts')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.crawlOtherResources)}
          onChange={(event) =>
            setCrawlConfig({ crawlOtherResources: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.crawlOtherResources')}
      </label>

      {hasResourceCrawl && (
        <>
          <label className="text-xs text-slate-400">
            {t('siteAudit.maxResources')}{' '}
            <input
              type="number"
              min="1"
              max="1000"
              value={crawlConfig.maxResourceRequests ?? 250}
              onChange={(event) =>
                setCrawlConfig({
                  maxResourceRequests: Number(event.target.value),
                })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>

          <label className="text-xs text-slate-400">
            {t('siteAudit.resourceConcurrency')}{' '}
            <span className="text-slate-600">
              {t('siteAudit.httpRequests')}
            </span>
            <input
              type="number"
              min="1"
              max="16"
              value={crawlConfig.maxConcurrentRequests ?? 4}
              onChange={(event) =>
                setCrawlConfig({
                  maxConcurrentRequests: Math.min(
                    16,
                    Math.max(1, Number(event.target.value) || 1),
                  ),
                })
              }
              className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-emerald-400"
            />
          </label>
        </>
      )}

      <label className="text-xs text-slate-400">
        {t('siteAudit.importCsv')}{' '}
        <span className="text-slate-600">
          {t('siteAudit.csvColumnLimit')}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void importSeedUrls(event.target.files?.[0])}
          className="mt-1.5 block w-full text-xs text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-2 file:py-1 file:text-xs file:text-slate-200"
        />
        {crawlConfig.seedUrls?.length ? (
          <span className="mt-1 block text-[11px] text-emerald-300">
            {t('siteAudit.urlsLoaded', {
              count: crawlConfig.seedUrls.length,
            })}
          </span>
        ) : null}
        {seedImportRejected.length ? (
          <span className="mt-1 block text-[11px] text-amber-300">
            {t('siteAudit.rowsRejected', {
              count: seedImportRejected.length,
            })}
          </span>
        ) : null}
      </label>

      <p className="text-xs leading-5 text-slate-500">
        {t('siteAudit.normalizationNotice')}
      </p>
    </>
  );
};
