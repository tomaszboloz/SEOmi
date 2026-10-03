import React from 'react';
import type { useSiteAuditSession } from './useSiteAuditSession';
import { CrawlRenderOptions } from './CrawlRenderOptions';
import { CrawlLimitsConfig } from './configForm/CrawlLimitsConfig';
import { CrawlScopeConfig } from './configForm/CrawlScopeConfig';
import { CrawlQueryConfig } from './configForm/CrawlQueryConfig';
import { CrawlRulesConfig } from './configForm/CrawlRulesConfig';
import { CrawlResourceConfig } from './configForm/CrawlResourceConfig';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlConfigurationForm: React.FC<{ session: Session }> = ({
  session,
}) => {
  const { crawlConfig } = session;

  return (
    <section className="grid gap-3 px-4 pb-4 md:grid-cols-3">
      {crawlConfig.crawlMode === 'browser-rendered' && (
        <CrawlRenderOptions session={session} />
      )}
      <CrawlLimitsConfig session={session} />
      <CrawlScopeConfig session={session} />
      <CrawlQueryConfig session={session} />
      <CrawlRulesConfig session={session} />
      <CrawlResourceConfig session={session} />
    </section>
  );
};
