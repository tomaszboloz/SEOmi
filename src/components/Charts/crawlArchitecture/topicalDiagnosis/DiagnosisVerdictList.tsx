import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiagnosisVerdict, VerdictSeverity } from '@/services/topicalDiagnosis';
import { SEVERITY_CLASSES, shortPath, verdictText } from './verdictText';

const SEVERITIES: VerdictSeverity[] = ['fix', 'weak', 'info', 'good'];
/** Cards rendered before the user asks for the rest; the filter buttons always show the full counts. */
const MAX_RENDERED = 120;

interface Props {
  verdicts: DiagnosisVerdict[];
  onOpenPage: (url: string) => void;
}

export const DiagnosisVerdictList = ({ verdicts, onOpenPage }: Props) => {
  const { t } = useTranslation();
  const translate = (key: string, values?: Record<string, unknown>) => t(key, values as Record<string, unknown>) as string;
  const [filter, setFilter] = useState<VerdictSeverity | 'all'>('all');
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, verdicts.filter((verdict) => verdict.severity === severity).length])) as Record<VerdictSeverity, number>;
  const [showAll, setShowAll] = useState(false);
  const matching = filter === 'all' ? verdicts : verdicts.filter((verdict) => verdict.severity === filter);
  const visible = showAll ? matching : matching.slice(0, MAX_RENDERED);

  return (
    <section aria-label={t('topicalDiagnosis.filter.all', { count: verdicts.length })} className="space-y-3">
      <div role="group" aria-label={t('topicalDiagnosis.filter.all', { count: verdicts.length })} className="flex flex-wrap gap-1.5 text-[11px]">
        {(['all', ...SEVERITIES] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`rounded-md border px-2 py-1 transition ${filter === option ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-100'}`}
          >
            {t(`topicalDiagnosis.filter.${option}`, { count: option === 'all' ? verdicts.length : counts[option] })}
          </button>
        ))}
      </div>
      {visible.length === 0 && <p className="text-xs text-slate-500">{t('topicalDiagnosis.empty')}</p>}
      <ul className="space-y-2">
        {visible.map((verdict) => {
          const copy = verdictText(translate, verdict);
          return (
            <li key={verdict.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className={`rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wide ${SEVERITY_CLASSES[verdict.severity]}`}>{copy.severity}</span>
                <span className="text-slate-500">{copy.scope}</span>
                {verdict.confidence === 'limited' && <span className="text-amber-300">{copy.confidence}</span>}
              </div>
              <p className="mt-1.5 text-xs font-semibold text-slate-100">{copy.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">{copy.action}</p>
              {verdict.urls.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {verdict.urls.map((url, index) => (
                    <li key={`${url}-${index}`}>
                      <button type="button" onClick={() => onOpenPage(url)} title={url} className="rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-sky-200 hover:border-sky-400">
                        {shortPath(url)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {copy.evidence.length > 0 && <p className="mt-2 text-[10px] text-slate-500">{copy.evidence.join(' · ')}</p>}
            </li>
          );
        })}
      </ul>
      {matching.length > visible.length && (
        <button type="button" onClick={() => setShowAll(true)} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          {t('topicalDiagnosis.showRemaining', { count: matching.length - visible.length })}
        </button>
      )}
    </section>
  );
};
