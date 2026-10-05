import React from 'react';
import { useDomainOverviewSession } from './domainOverview/useDomainOverviewSession';
import { DomainOverviewHeader } from './domainOverview/DomainOverviewHeader';
import { DomainOverviewMetrics } from './domainOverview/DomainOverviewMetrics';
import { DomainTopOrganic } from './domainOverview/DomainTopOrganic';
import { DomainCompetitors } from './domainOverview/DomainCompetitors';
import { DomainComparisonSection } from './domainOverview/DomainComparisonSection';
import { DataForSeoCostMeter } from '@/components/DataForSEO/cost/DataForSeoCostMeter';

export const DomainOverview: React.FC = () => {
  const session = useDomainOverviewSession();
  const { domainOverview, t } = session;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <DomainOverviewHeader session={session} />
      <DataForSeoCostMeter />

      {domainOverview && (
        <div className="space-y-8">
          <DomainOverviewMetrics overview={domainOverview} t={t} />
          <DomainTopOrganic overview={domainOverview} t={t} />
          <DomainCompetitors overview={domainOverview} t={t} />
          <DomainComparisonSection session={session} />
        </div>
      )}
    </div>
  );
};
