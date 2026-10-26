import { useTranslation } from 'react-i18next';
import type { OffPageHistoryRecord } from '@/services/offPage/historySchema';

export const OffPageHistoryDetails = ({ record }: { record: OffPageHistoryRecord }) => {
  const { t } = useTranslation();
  const unavailable = t('offPageSourcesUi.history.unavailable');
  return <div className="space-y-2 break-words">
    <p>{t('offPageSourcesUi.history.topic', { topic: record.topicLabel || unavailable })}</p>
    <p>{t('offPageSourcesUi.history.embedding', { provider: record.embeddingProvider, model: record.embeddingModelId ?? unavailable })}</p>
    <p>{t(`offPageSourcesUi.history.status.${record.tbva.status}`)}</p>
    {record.tbva.limitations.map((limitation) => <p key={limitation}>{t(`offPageSourcesUi.limitations.${limitation}`)}</p>)}
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption>{t('offPageSourcesUi.history.details')}</caption>
        <thead><tr>{['sourceUrl', 'fetchedAt', 'availability', 'authority', 'similarity', 'contribution'].map((field) =>
          <th scope="col" key={field}>{t(`offPageSourcesUi.history.fields.${field}`)}</th>)}</tr></thead>
        <tbody>{record.sources.map((source, index) => <tr key={`${source.sourceUrl}:${index}`}>
          <th scope="row">{source.sourceUrl}</th><td>{source.fetchedAt ?? t('offPageSourcesUi.notFetched')}</td>
          <td>{t(`offPageSourcesUi.fetch.${source.availability ?? 'pending'}`)}</td>
          <td>{source.authority ?? unavailable}</td><td>{source.similarity ?? unavailable}</td><td>{source.contribution ?? unavailable}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {record.coCitations.length > 0 && <ul aria-label={t('offPageSourcesUi.excerpts')}>
      {record.coCitations.map((hit, index) => <li key={`${hit.sourceUrl}:${hit.offset}:${index}`}>
        <p>{t('offPageSourcesUi.offset', { url: hit.sourceUrl, offset: hit.offset })}</p><blockquote>{hit.excerpt}</blockquote>
      </li>)}
    </ul>}
  </div>;
};
