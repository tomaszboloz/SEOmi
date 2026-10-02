import React from 'react';
import type { DomainComparisonData } from '@/types';
import type { TFunction } from 'i18next';

interface DomainComparisonTableProps {
  comparison: DomainComparisonData;
  t: TFunction;
}

export const DomainComparisonTable: React.FC<DomainComparisonTableProps> = ({
  comparison,
  t,
}) => {
  const maxTraffic = Math.max(
    ...comparison.rows.map((item) => item.organic_traffic ?? 0),
    1,
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full min-w-[920px] text-left text-xs">
        <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">{t('domainResearchUi.domain')}</th>
            <th className="px-3 py-2 text-right">{t('domainResearchUi.organicEtv')}</th>
            <th className="px-3 py-2 text-right">{t('domainResearchUi.keywords')}</th>
            <th className="px-3 py-2 text-right">{t('domainResearchUi.domainRankHeader')}</th>
            <th className="px-3 py-2 text-right">{t('domainResearchUi.referringHeader')}</th>
            <th className="px-3 py-2 text-right">{t('backlinkUi.totalBacklinks')}</th>
            <th className="px-3 py-2 text-right">{t('backlinkUi.dofollow')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {comparison.rows.map((row) => {
            const trafficWidth =
              row.organic_traffic === null
                ? 0
                : Math.round((row.organic_traffic / maxTraffic) * 100);
            const hasDetails =
              Boolean(row.top_keywords?.length) ||
              Boolean(row.top_pages?.length) ||
              Boolean(row.competitors?.length);

            return (
              <tr key={row.domain} className="text-slate-300 hover:bg-slate-800/30">
                <td className="px-3 py-2.5 font-mono font-medium text-white">
                  <div>
                    {row.domain}
                    {row.domain === comparison.target && (
                      <span className="ml-2 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                        {t('domainResearchUi.project')}
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block h-1 max-w-40 rounded-full bg-slate-800">
                    <span
                      className="block h-1 rounded-full bg-violet-400"
                      style={{ width: `${trafficWidth}%` }}
                    />
                  </span>
                  {hasDetails && (
                    <details className="mt-2 max-w-80 font-sans text-[10px] font-normal text-slate-400">
                      <summary className="cursor-pointer select-none text-violet-300">
                        {t('domainResearchUi.topKeywords')} · {t('domainResearchUi.topPages')}
                      </summary>
                      <div className="mt-2 space-y-2 rounded border border-slate-800 bg-slate-950/60 p-2">
                        <div>
                          <p className="mb-1 text-slate-500">{t('domainResearchUi.topKeywords')}</p>
                          {(row.top_keywords || []).slice(0, 5).map((k) => (
                            <div key={`${row.domain}-kw-${k.keyword}`} className="flex justify-between gap-2">
                              <span className="truncate" title={k.keyword}>{k.keyword}</span>
                              <span className="shrink-0 font-mono">{k.position === null ? '—' : `#${k.position}`}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <p className="mb-1 text-slate-500">{t('domainResearchUi.topPages')}</p>
                          {(row.top_pages || []).slice(0, 5).map((p) => (
                            <div key={`${row.domain}-page-${p.url}`} className="truncate" title={p.url}>{p.url}</div>
                          ))}
                        </div>
                        {(row.competitors || []).length > 0 && (
                          <div>
                            <p className="mb-1 text-slate-500">{t('domainResearchUi.competitors')}</p>
                            {(row.competitors || []).slice(0, 5).map((c) => (
                              <div key={`${row.domain}-comp-${c.domain}`} className="flex justify-between gap-2">
                                <span className="truncate">{c.domain}</span>
                                <span className="shrink-0 font-mono">{c.common_keywords ?? '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{row.organic_traffic?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">{row.organic_keywords?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">{row.domain_rank ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">{row.referring_domains?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">{row.total_backlinks?.toLocaleString() ?? '—'}</td>
                <td className="px-3 py-2.5 text-right font-mono">
                  {row.dofollow_ratio === null || row.dofollow_ratio === undefined ? '—' : `${row.dofollow_ratio}%`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
