import React from 'react';
import { cell, tableHead } from '../crawlResultsHelpers';
import { Table } from '../CrawlViewPrimitives';
import type { DirectivesSession } from './directivesTabTypes';
import { CrawlDirectivesRow } from './CrawlDirectivesRow';

interface CrawlRobotsDirectivesSectionProps {
  session: DirectivesSession;
}

export const CrawlRobotsDirectivesSection: React.FC<CrawlRobotsDirectivesSectionProps> = ({
  session,
}) => {
  const { result, t } = session;

  return (
    <Table minWidth="min-w-[1280px]">
      <thead className={tableHead}>
        <tr>
          {[
            t('crawl.ui.url'),
            t('crawl.ui.httpStatusLabel'),
            t('crawlDeepUi.indexability'),
            t('crawlDeepUi.canonicalRelation'),
            t('crawlDeepUi.canonicalTargets'),
            t('crawlDeepUi.canonicalConflict'),
            t('crawlDeepUi.metaRobots'),
            t('crawlDeepUi.xRobotsTag'),
            t('crawlDeepUi.robotsVerdict'),
          ].map((label) => (
            <th key={label} className={cell}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.pages.map((page) => (
          <CrawlDirectivesRow
            key={page.url}
            page={page}
            crawlMode={result.crawl_mode}
            t={t}
          />
        ))}
      </tbody>
    </Table>
  );
};
