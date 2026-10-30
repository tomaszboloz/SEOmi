import React from 'react';
import { useTranslation } from 'react-i18next';
import { compareIgosRuns, historyEntry, type IgosHistoryEntry } from '@/services/igos/history';
import type { IgosReport } from '@/services/igos/report';

const score = (value: number | null): string => (value === null ? '—' : String(value));
const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/** Per-source drill-down: how many target paragraphs echo each competitor page or are nearest to it in gain zones. */
export const sourceZoneCounts = (report: IgosReport, url: string): { echo: number; gain: number } => ({
  echo: report.zones.filter((zone) => zone.zone === 'echo' && zone.evidence?.url === url).length,
  gain: report.zones.filter((zone) => zone.zone === 'gain' && zone.evidence?.url === url).length,
});

/** Run identity (URL/run/model), per-source drill-down and the stored phrase history (GEM-68-01/06). */
export const IgosRunDetails: React.FC<{ report: IgosReport; history: IgosHistoryEntry[] }> = ({ report, history }) => {
  const { t } = useTranslation();
  const run = report.provenance;
  if (!run) return null;
  const current = historyEntry(report) as IgosHistoryEntry;
  const previous = history.find((entry) => entry.runAt !== run.runAt);
  const comparison = compareIgosRuns(current, previous);
  return (
    <div className="space-y-2 text-xs" data-testid="igos-run-details">
      <p>{t('igosUi.run', { runAt: run.runAt, provider: run.provider, model: run.model, url: run.targetUrl })}</p>
      {comparison.kind === 'first' && <p>{t('igosUi.compareFirst')}</p>}
      {comparison.kind === 'model-changed' && <p role="status" className="text-amber-300">{t('igosUi.compareModelChanged', { previous: `${comparison.previous.provider} / ${comparison.previous.model}` })}</p>}
      {(comparison.kind === 'same-basis' || comparison.kind === 'baseline-changed') && (
        <p role="status" className={comparison.kind === 'baseline-changed' ? 'text-amber-300' : undefined}>
          {comparison.delta === null ? t('igosUi.compareNoDelta') : t(comparison.kind === 'same-basis' ? 'igosUi.compareSameBasis' : 'igosUi.compareBaselineChanged', { delta: signed(comparison.delta) })}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-slate-200">{t('igosUi.sources', { n: run.docs.length })}</summary>
        <ul className="mt-1 space-y-1">
          {run.docs.map((doc) => {
            const counts = sourceZoneCounts(report, doc.url);
            return <li key={doc.url} className="break-all">{t('igosUi.sourceRow', { rank: doc.rank, url: doc.url, fetchedAt: doc.fetchedAt ?? '—', echo: counts.echo, gain: counts.gain })}</li>;
          })}
        </ul>
      </details>
      {history.length > 1 && (
        <details>
          <summary className="cursor-pointer text-slate-200">{t('igosUi.history', { n: history.length })}</summary>
          <ul className="mt-1 space-y-1">
            {history.map((entry) => <li key={entry.runAt}>{t('igosUi.historyRow', { runAt: entry.runAt, score: score(entry.igos), provider: entry.provider, model: entry.model, available: entry.availableDocs, requested: entry.requestedDocs })}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
};
