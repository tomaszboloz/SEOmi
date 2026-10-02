import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { CrawlClientRedirectsSection } from './directivesTab/CrawlClientRedirectsSection';
import { CrawlRobotsDirectivesSection } from './directivesTab/CrawlRobotsDirectivesSection';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlDirectivesTab: React.FC<{ session: Session }> = ({ session }) => {
  return (
    <div className="space-y-5">
      <CrawlClientRedirectsSection session={session} />
      <CrawlRobotsDirectivesSection session={session} />
    </div>
  );
};
