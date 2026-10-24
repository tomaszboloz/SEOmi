import { csv } from '@/services/export/csv';
import type { OffPageHistoryRecord } from './historySchema';

export const offPageHistoryCsv = (record: OffPageHistoryRecord): string => csv([
  ['section', 'source_url', 'fetched_at', 'availability', 'authority', 'similarity', 'contribution', 'offset', 'linked', 'excerpt'],
  ...record.sources.map((source) => ['source', source.sourceUrl, source.fetchedAt, source.availability,
    source.authority, source.similarity, source.contribution, '', '', '']),
  ...record.coCitations.map((hit) => {
    const source = record.sources.find((row) => row.sourceUrl === hit.sourceUrl);
    return ['co_citation', hit.sourceUrl, source?.fetchedAt, source?.availability, source?.authority,
      source?.similarity, source?.contribution, hit.offset, hit.linked, hit.excerpt];
  }),
]);

export const offPageCsvFilename = (projectId: string, createdAt: string): string =>
  `seomi-offpage-${projectId.replace(/[^a-z0-9_-]/giu, '_')}-${createdAt.slice(0, 10)}.csv`;
