import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PageAuditData } from '@/types';
import { PerformanceSummaryCards } from './performanceMetrics/PerformanceSummaryCards';
import { PerformanceHttpSection } from './performanceMetrics/PerformanceHttpSection';
import { PerformanceRedirectWaterfall } from './performanceMetrics/PerformanceRedirectWaterfall';
import { PerformanceDiscoveryFiles } from './performanceMetrics/PerformanceDiscoveryFiles';

interface PerformanceMetricsProps {
  audit: PageAuditData;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ audit }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <PerformanceSummaryCards audit={audit} t={t} />

      {audit.http_performance && (
        <PerformanceHttpSection httpPerformance={audit.http_performance} t={t} />
      )}

      <PerformanceRedirectWaterfall
        redirectChain={audit.redirect_chain}
        finalUrl={audit.final_url}
        httpStatus={audit.http_status}
        t={t}
      />

      <PerformanceDiscoveryFiles technical={audit.technical} t={t} />
    </div>
  );
};
