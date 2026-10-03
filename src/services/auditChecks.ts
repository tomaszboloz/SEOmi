import type { PageAuditData } from '@/types';
import { LocalAuditCheck } from './auditChecks/auditChecksBase';
import { buildHttpAndUrlChecks, buildMetaAndIndexabilityChecks } from './auditChecks/httpAndMetaChecks';
import {
  buildOpenGraphChecks,
  buildTwitterCardChecks,
  buildHeadingsChecks,
} from './auditChecks/socialAndHeadingsChecks';
import { buildMediaChecks, buildLinksChecks } from './auditChecks/mediaAndLinksChecks';
import {
  buildSecurityChecks,
  buildStructuredDataChecks,
  buildTechnicalChecks,
} from './auditChecks/securityAndTechnicalChecks';
import {
  buildAccessibilityChecks,
  buildContentChecks,
  buildAmpAndTransportChecks,
} from './auditChecks/accessibilityAndContentChecks';

export type {
  AuditCheckStatus,
  AuditCheckCategory,
  LocalAuditCheck,
} from './auditChecks/auditChecksBase';

/**
 * Evidence-backed local checks. Every item is independently inspectable and
 * comes from the stored audit; no provider/API values are invented here.
 */
export const buildLocalAuditChecks = (audit: PageAuditData): LocalAuditCheck[] => {
  return [
    ...buildHttpAndUrlChecks(audit),
    ...buildMetaAndIndexabilityChecks(audit),
    ...buildOpenGraphChecks(audit),
    ...buildTwitterCardChecks(audit),
    ...buildHeadingsChecks(audit),
    ...buildMediaChecks(audit),
    ...buildLinksChecks(audit),
    ...buildSecurityChecks(audit),
    ...buildStructuredDataChecks(audit),
    ...buildTechnicalChecks(audit),
    ...buildAccessibilityChecks(audit),
    ...buildContentChecks(audit),
    ...buildAmpAndTransportChecks(audit),
  ];
};
