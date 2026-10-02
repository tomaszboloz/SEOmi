import React from 'react';
import type { CrawledPageIssue } from '@/types';
import type { TFunction } from 'i18next';
import { localizeCrawlIssue } from '@/services/crawlIssueLocalization';

interface CrawlPageEvidenceIssuesProps {
  issues: CrawledPageIssue[];
  t: TFunction;
}

export const CrawlPageEvidenceIssues: React.FC<CrawlPageEvidenceIssuesProps> = ({
  issues,
  t,
}) => {
  if (!issues.length) {
    return <p>{t('crawl.ui.noIssuesForUrl')}</p>;
  }

  return (
    <ul className="list-inside list-disc space-y-1 text-amber-200">
      {issues.map((issue, index) => (
        <li key={`${issue.severity || 'issue'}-${index}`}>
          <span className="font-semibold">
            {t(`crawl.ui.severityValues.${(issue.severity || 'warning').toLowerCase()}`)}:
          </span>{' '}
          {localizeCrawlIssue(issue, t).displayMessage}
        </li>
      ))}
    </ul>
  );
};
