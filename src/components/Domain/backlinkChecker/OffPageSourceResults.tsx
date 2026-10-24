import { useTranslation } from 'react-i18next';
import type { SourceEvidence } from '@/services/offPage/sources';
import type { OffPageReports } from './useOffPageReports';

export const OffPageSourceResults = ({ sources, reports }: { sources: SourceEvidence[]; reports: OffPageReports }) => {
  const { t } = useTranslation();
  const hits = [...reports.coCitation.linked, ...reports.coCitation.unlinked];
  return <div className="space-y-2 break-words">
    <p>{t('offPageSourcesUi.scored', { scored: reports.tbva.counted, total: sources.length })}</p>
    {reports.tbva.limitations.map((limitation) => <p key={limitation}>{t(`offPageSourcesUi.limitations.${limitation}`)}</p>)}
    <ul aria-label={t('offPageSourcesUi.sources')}>
      {sources.map((source) => <li key={source.sourceUrl}>
        <span>{source.sourceUrl}</span>{' — '}
        <span>{t(`offPageSourcesUi.fetch.${source.availability ?? 'pending'}`)}</span>{' — '}
        <span>{t('offPageSourcesUi.fetchedAt', { time: source.fetchedAt ?? t('offPageSourcesUi.notFetched') })}</span>
      </li>)}
    </ul>
    <p>{t('offPageSourcesUi.context')}</p>
    <p>{t('offPageSourcesUi.caveat')}</p>
    <ul aria-label={t('offPageSourcesUi.excerpts')}>
      {hits.map((hit) => <li key={`${hit.sourceUrl}:${hit.offset}`}>
        <p>{t('offPageSourcesUi.offset', { url: hit.sourceUrl, offset: hit.offset })}</p>
        <blockquote>{hit.excerpt}</blockquote>
        <p>{t(`offPageSourcesUi.polarity.${hit.polarity}`)}</p>
      </li>)}
    </ul>
    <p>{t('offPageSourcesUi.missing')}</p>
  </div>;
};
