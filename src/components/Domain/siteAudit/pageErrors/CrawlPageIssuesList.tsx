import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawledRedirectHop, CrawledPageIssue } from '@/types';
import { localizeCrawlIssue } from '@/services/crawlIssueLocalization';

interface CrawlPageIssuesListProps {
  redirectChain: CrawledRedirectHop[];
  issues: CrawledPageIssue[];
  t: TFunction;
}

export const CrawlPageIssuesList: React.FC<CrawlPageIssuesListProps> = ({
  redirectChain,
  issues,
  t,
}) => {
  return (
    <>
      {redirectChain.length > 0 && (
        <div className="mb-3 rounded-md border border-slate-800 bg-slate-900/50 p-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {t('siteAudit.redirectChain')}
          </p>
          {redirectChain.map((hop, index) => (
            <p
              key={`${hop.from_url}-${index}`}
              className="truncate text-[11px] text-slate-400"
            >
              <span className="font-mono text-amber-300">
                {hop.http_status}
              </span>{' '}
              · {hop.from_url} → {hop.to_url}
            </p>
          ))}
        </div>
      )}

      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {t('siteAudit.identifiedIssues')}
      </div>
      {issues.map((issue, idx) => (
        <div key={idx} className="flex items-center space-x-2 text-xs">
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
              issue.severity === 'Critical'
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {t(`siteAudit.severityValues.${issue.severity}`)}
          </span>
          <span className="text-slate-300">
            {localizeCrawlIssue(issue, t).displayMessage}
          </span>
        </div>
      ))}
    </>
  );
};
