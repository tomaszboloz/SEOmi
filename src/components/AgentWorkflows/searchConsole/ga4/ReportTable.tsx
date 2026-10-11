import type { Ga4Rows, Ga4T } from './viewTypes';

interface Props { rows: Ga4Rows; t: Ga4T; }
const value = (number: number | undefined, t: Ga4T): string => number === undefined ? t('ga4.unknown') : number.toLocaleString();

export function Ga4ReportTable({ rows, t }: Props) {
  if (!rows.length) return <p className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">{t('ga4.noRows')}</p>;
  return <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
    <table className="w-full min-w-[960px] text-left text-xs text-slate-300">
      <thead className="border-b border-slate-800 text-[11px] uppercase text-slate-500"><tr>
        <th className="px-3 py-3">{t('ga4.landingPage')}</th><th className="px-3 py-3">{t('ga4.host')}</th>
        <th className="px-3 py-3 text-right">{t('ga4.sessions')}</th><th className="px-3 py-3 text-right">{t('ga4.engagedSessions')}</th>
        <th className="px-3 py-3 text-right">{t('ga4.keyEvents')}</th><th className="px-3 py-3 text-right">{t('ga4.clicks')}</th>
        <th className="px-3 py-3 text-right">{t('ga4.impressions')}</th><th className="px-3 py-3 text-right">{t('ga4.issues')}</th>
      </tr></thead>
      <tbody>{rows.map((row, index) => <tr key={`${row.host_name}:${row.landing_page}:${index}`} className="border-b border-slate-800/70 last:border-0">
        <td className="max-w-[320px] truncate px-3 py-3 font-mono text-sky-200" title={row.landing_page}>{row.landing_page}</td>
        <td className="px-3 py-3 font-mono">{row.host_name}</td><td className="px-3 py-3 text-right">{value(row.sessions, t)}</td>
        <td className="px-3 py-3 text-right">{value(row.engaged_sessions, t)}</td><td className="px-3 py-3 text-right">{value(row.key_events, t)}</td>
        <td className="px-3 py-3 text-right">{value(row.gsc?.clicks, t)}</td><td className="px-3 py-3 text-right">{value(row.gsc?.impressions, t)}</td>
        <td className="px-3 py-3 text-right">{value(row.crawl_issue_count, t)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
