import React from 'react';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

interface CrawlRulesConfigProps {
  session: Session;
}

export const CrawlRulesConfig: React.FC<CrawlRulesConfigProps> = ({ session }) => {
  const { crawlConfig, setCrawlConfig, t } = session;

  return (
    <>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.respectRobots}
          onChange={(event) =>
            setCrawlConfig({ respectRobots: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.respectRobots')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.respectCrawlDelay}
          onChange={(event) =>
            setCrawlConfig({ respectCrawlDelay: event.target.checked })
          }
          disabled={!crawlConfig.respectRobots}
          className="accent-emerald-400 disabled:opacity-40"
        />
        {t('siteAudit.respectCrawlDelay')}{' '}
        <span className="text-slate-600">{t('siteAudit.max60Seconds')}</span>
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.discoverSitemaps}
          onChange={(event) =>
            setCrawlConfig({ discoverSitemaps: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.discoverSitemaps')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={crawlConfig.followNofollow}
          onChange={(event) =>
            setCrawlConfig({ followNofollow: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.followNofollow')}
      </label>

      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={Boolean(crawlConfig.listMode)}
          onChange={(event) =>
            setCrawlConfig({ listMode: event.target.checked })
          }
          className="accent-emerald-400"
        />
        {t('siteAudit.listMode')}
      </label>

      <label className="text-xs text-slate-400">
        {t('siteAudit.focusPhrase')}{' '}
        <span className="text-slate-600">
          {t('siteAudit.optionalEvidence')}
        </span>
        <input
          aria-label={t('siteAudit.focusPhraseAria')}
          value={crawlConfig.focusPhrase || ''}
          maxLength={160}
          onChange={(event) =>
            setCrawlConfig({ focusPhrase: event.target.value })
          }
          placeholder={t('siteAudit.focusPhrasePlaceholder')}
          className="mt-1.5 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
        />
      </label>
    </>
  );
};
