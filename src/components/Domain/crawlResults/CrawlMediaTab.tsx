import React from 'react';
import type { useCrawlResultsSession } from './useCrawlResultsSession';
import { CrawlMediaImagesSection } from './mediaTab/CrawlMediaImagesSection';
import { CrawlMediaResourcesSection } from './mediaTab/CrawlMediaResourcesSection';

type Session = ReturnType<typeof useCrawlResultsSession>;

export const CrawlMediaTab: React.FC<{ session: Session }> = ({ session }) => {
  const {
    resourceInventory,
    resourceProvenanceFilter,
    result,
    setResourceProvenanceFilter,
    t,
    visibleResourceInventory,
  } = session;

  return (
    <div className="space-y-6">
      <CrawlMediaImagesSection pages={result.pages} t={t} />
      <CrawlMediaResourcesSection
        resourceInventory={resourceInventory}
        visibleResourceInventory={visibleResourceInventory}
        resourceLimitReached={result.resource_limit_reached}
        filter={resourceProvenanceFilter}
        onFilterChange={setResourceProvenanceFilter}
        t={t}
      />
    </div>
  );
};
