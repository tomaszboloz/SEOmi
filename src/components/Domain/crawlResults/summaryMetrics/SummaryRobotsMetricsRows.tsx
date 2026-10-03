import React from 'react';
import type { TFunction } from 'i18next';
import type { SiteCrawlResult } from '@/types';
import { cell } from '../crawlResultsHelpers';

interface SummaryRobotsMetricsRowsProps {
  result: SiteCrawlResult;
  t: TFunction;
}

export const SummaryRobotsMetricsRows: React.FC<SummaryRobotsMetricsRowsProps> = ({
  result,
  t,
}) => {
  return (
    <>
      <tr>
        <th className={cell}>{t('crawl.ui.robotsTxt')}</th>
        <td className={`${cell} text-slate-300`}>
          {t('crawl.ui.robotsSummary', {
            status: result.robots_txt_status,
            blocked: result.robots_blocked_count,
          })}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t('crawl.ui.robotsUserAgent')}</th>
        <td className={`${cell} break-all font-mono text-slate-300`}>
          {result.robots_user_agent || t('crawl.ui.noDataOlderRun')}
        </td>
      </tr>
      <tr>
        <th className={cell}>{t('crawl.ui.robotsRules')}</th>
        <td className={`${cell} text-slate-300`}>
          {result.robots_applicable_rules?.length ? (
            <ul className="space-y-1">
              {result.robots_applicable_rules.map((rule, index) => (
                <li key={`${rule.directive}-${rule.path}-${index}`} className="font-mono">
                  {rule.directive.toUpperCase()}: {rule.path}
                </li>
              ))}
            </ul>
          ) : (
            t('crawl.ui.noRulesOlderRun')
          )}
        </td>
      </tr>
      {result.robots_agent_matrix?.length ? (
        <tr>
          <th className={cell}>{t('crawl.ui.robotsUserAgent')}</th>
          <td className={`${cell} text-slate-300`}>
            <ul className="space-y-2">
              {result.robots_agent_matrix.map((agent) => (
                <li key={agent.user_agent} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-slate-200">{agent.user_agent}</span>
                    <span className="text-slate-500">
                      {agent.applicable_rules.length} {t('crawl.ui.robotsRules').toLocaleLowerCase()}
                    </span>
                    <span className={agent.specific_group ? 'text-emerald-300' : 'text-slate-500'}>
                      {agent.specific_group ? '✓' : '*'}
                    </span>
                    {agent.crawl_delay_ms != null ? (
                      <span className="font-mono text-slate-500">
                        {agent.crawl_delay_ms} {t('performance.milliseconds')}
                      </span>
                    ) : null}
                  </div>
                  {agent.applicable_rules.length ? (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[10px] text-slate-500">
                      {agent.applicable_rules.slice(0, 12).map((rule, index) => (
                        <span key={`${agent.user_agent}-${rule.directive}-${rule.path}-${index}`}>
                          {rule.directive.toUpperCase()}: {rule.path}
                        </span>
                      ))}
                      {agent.applicable_rules.length > 12 ? (
                        <span>+{agent.applicable_rules.length - 12}</span>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
      <tr>
        <th className={cell}>{t('crawl.ui.robotsSitemap')}</th>
        <td className={`${cell} text-slate-300`}>
          {result.robots_sitemap_directives?.length ? (
            <ul className="space-y-1">
              {result.robots_sitemap_directives.map((url, index) => (
                <li key={`${url}-${index}`} className="break-all font-mono">
                  {url}
                </li>
              ))}
            </ul>
          ) : (
            t('crawl.ui.noDeclarationsOlderRun')
          )}
        </td>
      </tr>
    </>
  );
};
