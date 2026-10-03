import React from 'react';
import { Empty } from './CrawlViewPrimitives';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { isSocialPage } from './socialTab/socialTabTypes';
import { CrawlSocialTable } from './socialTab/CrawlSocialTable';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlSocialTab: React.FC<{ session: Session }> = ({ session }) => {
  const { result, t } = session;
  const socialPages = result.pages.filter(isSocialPage);

  if (!socialPages.length) {
    return <Empty>{t('crawl.social.empty')}</Empty>;
  }

  return <CrawlSocialTable socialPages={socialPages} t={t} />;
};
