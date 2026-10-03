import React from 'react';
import type { TFunction } from 'i18next';
import type { CrawlResourceInventoryRow } from '@/services/crawlResources';
import { ResourceProvenanceFilter, cell, tableHead } from '../crawlResultsHelpers';
import { Empty, Table } from '../CrawlViewPrimitives';
import { CrawlMediaResourceFilter } from './CrawlMediaResourceFilter';
import { CrawlMediaResourceRow } from './CrawlMediaResourceRow';

interface CrawlMediaResourcesSectionProps {
  resourceInventory: CrawlResourceInventoryRow[];
  visibleResourceInventory: CrawlResourceInventoryRow[];
  resourceLimitReached?: boolean;
  filter: ResourceProvenanceFilter;
  onFilterChange: (filter: ResourceProvenanceFilter) => void;
  t: TFunction;
}

export const CrawlMediaResourcesSection: React.FC<CrawlMediaResourcesSectionProps> = ({
  resourceInventory,
  visibleResourceInventory,
  resourceLimitReached,
  filter,
  onFilterChange,
  t,
}) => {
  const headers = [
    t('crawlDeepUi.resourceType'),
    t('crawl.ui.status'),
    t('crawl.ui.resource'),
    t('crawl.ui.sources'),
    t('siteAudit.contentType'),
    t('crawl.ui.size'),
    t('crawl.ui.intrinsicDimensions'),
    t('crawl.ui.httpTime'),
    t('crawl.ui.provenance'),
  ];

  return (
    <section>
      <CrawlMediaResourceFilter
        visibleCount={visibleResourceInventory.length}
        totalCount={resourceInventory.length}
        resourceLimitReached={resourceLimitReached}
        filter={filter}
        onFilterChange={onFilterChange}
        t={t}
      />
      <p className="mb-2 text-[11px] text-slate-500">{t('crawlDeepUi.resourceTimingNote')}</p>
      {visibleResourceInventory.length > 0 ? (
        <Table minWidth="min-w-[980px]">
          <thead className={tableHead}>
            <tr>
              {headers.map((label) => (
                <th key={label} className={cell}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleResourceInventory.map((row) => (
              <CrawlMediaResourceRow key={row.resource.url} row={row} t={t} />
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>
          {resourceInventory.length > 0
            ? t('crawl.ui.noResourcesForFilter')
            : t('crawl.ui.noAdditionalResources')}
        </Empty>
      )}
    </section>
  );
};
