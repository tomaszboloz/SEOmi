import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadText } from '@/services/export/download';
import { compareOffPageHistory } from '@/services/offPage/historyComparison';
import { offPageCsvFilename, offPageHistoryCsv } from '@/services/offPage/historyCsv';
import type { OffPageHistoryRecord } from '@/services/offPage/historySchema';
import { OffPageHistoryDetails } from './OffPageHistoryDetails';
import { useOffPageHistory } from './useOffPageHistory';

interface Props { projectId: string | null; current: OffPageHistoryRecord | null; saved: boolean }

export const OffPageHistory = ({ projectId, current, saved }: Props) => {
  const { t, i18n } = useTranslation();
  const history = useOffPageHistory(projectId, current);
  const [selected, setSelected] = useState<string | null>(null);
  if (!projectId) return null;
  const exportRecord = (record: OffPageHistoryRecord) => {
    downloadText(offPageCsvFilename(projectId, record.createdAt), offPageHistoryCsv(record), 'text/csv');
  };
  return <section className="space-y-3" aria-label={t('offPageSourcesUi.history.title')}>
    <h3>{t('offPageSourcesUi.history.title')}</h3>
    <p>{t('offPageSourcesUi.history.privacy')}</p>
    {current && <button type="button" onClick={() => exportRecord(current)}>{t('offPageSourcesUi.history.exportCurrent')}</button>}
    {(!saved || history.error) && <p role="alert">{t('offPageSourcesUi.history.storageError')}</p>}
    {history.records.length > 0 ? <>
      <button type="button" onClick={history.clear}>{t('offPageSourcesUi.history.clear')}</button>
      <ol className="space-y-3">{history.records.map((record, index) => {
        const comparison = compareOffPageHistory(record, history.records[index + 1]);
        const expanded = selected === record.id;
        return <li key={record.id} className="space-y-2">
          <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString(i18n.resolvedLanguage)}</time>
          <p>{t('offPageSourcesUi.history.summary', { value: record.tbva.value ?? t('offPageSourcesUi.history.unavailable'),
            scored: record.sourcesScored, requested: record.sourcesRequested })}</p>
          <p>{comparison.reason ? t('offPageSourcesUi.history.notComparable', { reason: t(`offPageSourcesUi.history.reasons.${comparison.reason}`) })
            : t('offPageSourcesUi.history.delta', { delta: new Intl.NumberFormat(i18n.resolvedLanguage,
              { signDisplay: 'always', maximumFractionDigits: 3 }).format(comparison.delta) })}</p>
          <button type="button" aria-expanded={expanded} aria-controls={`offpage-history-${record.id}`}
            onClick={() => setSelected(expanded ? null : record.id)}>{t(`offPageSourcesUi.history.${expanded ? 'hide' : 'view'}`)}</button>
          <button type="button" onClick={() => exportRecord(record)}>{t('offPageSourcesUi.history.exportRecord')}</button>
          <button type="button" onClick={() => history.remove(record.id)}>{t('offPageSourcesUi.history.delete')}</button>
          {expanded && <div id={`offpage-history-${record.id}`}><OffPageHistoryDetails record={record} /></div>}
        </li>;
      })}</ol>
    </> : <p>{t('offPageSourcesUi.history.empty')}</p>}
  </section>;
};
