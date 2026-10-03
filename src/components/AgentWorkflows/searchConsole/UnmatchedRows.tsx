import { useTranslation } from 'react-i18next';
import type { GscSnapshotComparison } from '@/services/gscPerformanceTracker';

export function SearchConsoleUnmatchedRows({ rows }: { rows: GscSnapshotComparison['unmatchedRows'] }) {
  const { t } = useTranslation();
  if (!rows || !Object.values(rows).some(values => values.length)) return null;
  const groups = ['baselineQueries', 'currentQueries', 'baselinePages', 'currentPages'] as const;
  return <section className="space-y-2 border-t border-slate-800 pt-3">
    <p role="note" className="text-xs text-amber-300">{t('searchConsole.unmatchedDescription')}</p>
    {groups.filter(group => rows[group].length).map(group => <details key={group} className="text-xs text-slate-300">
      <summary className="cursor-pointer">{t(`searchConsole.unmatched.${group}`, { count: rows[group].length })}</summary>
      <ul className="mt-2 space-y-1">{rows[group].map(value => <li key={value} className="break-all">{value}</li>)}</ul>
    </details>)}
  </section>;
}
