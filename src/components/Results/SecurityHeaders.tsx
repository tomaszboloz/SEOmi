import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PageAuditData } from '@/types';
import { useAuditStore } from '@/stores/auditStore';
import { buildHeaderSpecs } from './securityHeaders/securityHeadersTypes';
import { SecurityScoreBanner } from './securityHeaders/SecurityScoreBanner';
import { SecurityTransportSection } from './securityHeaders/SecurityTransportSection';
import { SecurityDisclosureCards } from './securityHeaders/SecurityDisclosureCards';
import { SecurityHeadersList } from './securityHeaders/SecurityHeadersList';

interface SecurityHeadersProps {
  audit: PageAuditData;
}

export const SecurityHeaders: React.FC<SecurityHeadersProps> = ({ audit }) => {
  const { t } = useTranslation();
  const { security_headers, technical } = audit;
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);

  const headerSpecs = useMemo(
    () => buildHeaderSpecs(security_headers, t),
    [security_headers, t],
  );

  const visibleHeaderSpecs = useMemo(
    () => (showOnlyProblems ? headerSpecs.filter((spec) => !spec.value) : headerSpecs),
    [headerSpecs, showOnlyProblems],
  );

  const serverHeader = security_headers.server || technical?.server;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <SecurityScoreBanner score={security_headers.score} t={t} />

      <SecurityTransportSection transport={audit.transport_security} t={t} />

      <SecurityDisclosureCards
        serverHeader={serverHeader}
        xPoweredBy={security_headers.x_powered_by}
        t={t}
      />

      <SecurityHeadersList
        totalCount={headerSpecs.length}
        specs={visibleHeaderSpecs}
        t={t}
      />
    </div>
  );
};
