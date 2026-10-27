import { useTranslation } from 'react-i18next';
import type { AuthorityHistoryEntry } from '@/services/topicalAuthorityMonitoring';

const W = 480;
const H = 160;
const PAD = 24;

/** Dual timeline: SFS (solid) and TAS (dashed) per full analysis, with milestone markers. */
export const AuthorityHistoryChart = ({ entries }: { entries: AuthorityHistoryEntry[] }) => {
  const { t, i18n } = useTranslation();
  const rtl = i18n.dir() === 'rtl';
  const step = (W - PAD * 2) / Math.max(1, entries.length - 1);
  const xOf = (index: number): number => (rtl ? W - PAD - index * step : PAD + index * step);
  const yOf = (score: number): number => H - PAD - (Math.min(100, Math.max(0, score)) / 100) * (H - PAD * 2);
  const date = (at: string): string => new Date(at).toLocaleDateString(i18n.language);
  const tasPoints = entries.flatMap((entry, index) => (entry.snapshot.tas === null ? [] : [`${xOf(index)},${yOf(entry.snapshot.tas)}`]));
  const marks = entries.flatMap((entry) => entry.annotations.map((note) => ({ entry, note })));
  return (
    <section aria-labelledby="authority-history-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="authority-history-title" className="text-sm font-semibold text-slate-200">{t('authority.history.title')}</h2>
      {entries.length < 2 ? <p className="text-xs text-slate-500">{t('authority.history.empty')}</p> : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('authority.history.aria', { count: entries.length })} className="h-40 w-full">
            {[0, 50, 100].map((tick) => <line key={tick} x1={PAD} x2={W - PAD} y1={yOf(tick)} y2={yOf(tick)} className="stroke-slate-800" />)}
            <polyline fill="none" strokeWidth={2} className="stroke-emerald-400" points={entries.map((entry, index) => `${xOf(index)},${yOf(entry.snapshot.sfs)}`).join(' ')} />
            {tasPoints.length > 1 && <polyline fill="none" strokeWidth={2} strokeDasharray="5 4" className="stroke-sky-400" points={tasPoints.join(' ')} />}
            {entries.map((entry, index) => <circle key={entry.snapshot.runId} cx={xOf(index)} cy={yOf(entry.snapshot.sfs)} r={3} className="fill-emerald-300"><title>{t('authority.history.point', { date: date(entry.snapshot.at), sfs: entry.snapshot.sfs, tas: entry.snapshot.tas ?? '—' })}</title></circle>)}
          </svg>
          <p className="flex gap-4 text-[11px] text-slate-400"><span className="text-emerald-300">{t('authority.history.sfs')}</span><span className="text-sky-300">{t('authority.history.tas')}</span></p>
          <ul aria-label={t('authority.history.milestones')} className="space-y-1 text-xs text-slate-300">
            {marks.map(({ entry, note }, index) => <li key={`${entry.snapshot.runId}:${note.code}:${index}`}><span className="text-slate-500">{date(entry.snapshot.at)}: </span>{t(`authority.history.${note.code}`, note.params as Record<string, number | string>)}</li>)}
          </ul>
        </>
      )}
    </section>
  );
};
