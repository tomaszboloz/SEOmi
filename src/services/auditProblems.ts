import { PageAuditData } from '@/types';
import i18n from '@/i18n';
import { localizeStructuredDataFinding } from '@/services/schemaIssueLocalization';
import { localizeAmpFinding } from '@/services/ampIssueLocalization';

export interface AuditProblem {
  id: string;
  label: string;
  detail: string;
  /** Raw provider/parser output retained as evidence, never as the primary UI copy. */
  evidence?: string;
  severity: 'error' | 'warning';
}

const hasNoIndexDirective = (value?: string) => /(?:^|[\s,;])(noindex|none)(?:$|[\s,;])/i.test(value || '');

/**
 * Deterministic, audit-record based findings. These deliberately do not infer
 * whether an arbitrary Schema.org object is valid or whether a preview will be
 * rendered by a third-party social network.
 */
export const getMetadataProblems = (audit: PageAuditData): AuditProblem[] => {
  const { meta_tags: meta, indexability } = audit;
  const problems: AuditProblem[] = [];

  if (!meta.title) problems.push({ id: 'metadata-title-missing', label: i18n.t('auditProblems.metadata.titleMissing'), detail: i18n.t('auditProblems.metadata.titleMissingDetail'), severity: 'error' });
  else if (meta.title_length < 40 || meta.title_length > 65) problems.push({ id: 'metadata-title-length', label: i18n.t('auditProblems.metadata.titleLength'), detail: i18n.t('auditProblems.metadata.lengthDetail', { count: meta.title_length, min: 40, max: 65 }), severity: 'warning' });

  if (!meta.description) problems.push({ id: 'metadata-description-missing', label: i18n.t('auditProblems.metadata.descriptionMissing'), detail: i18n.t('auditProblems.metadata.descriptionMissingDetail'), severity: 'error' });
  else if (meta.description_length < 120 || meta.description_length > 165) problems.push({ id: 'metadata-description-length', label: i18n.t('auditProblems.metadata.descriptionLength'), detail: i18n.t('auditProblems.metadata.lengthDetail', { count: meta.description_length, min: 120, max: 165 }), severity: 'warning' });

  if (!meta.canonical) problems.push({ id: 'metadata-canonical-missing', label: i18n.t('auditProblems.metadata.canonicalMissing'), detail: i18n.t('auditProblems.metadata.canonicalMissingDetail'), severity: 'warning' });
  if (indexability?.canonical_target_checked && (!indexability.canonical_target_status || indexability.canonical_target_status >= 400)) {
    problems.push({ id: 'metadata-canonical-target', label: i18n.t('auditProblems.metadata.canonicalTarget'), detail: i18n.t('auditProblems.metadata.canonicalTargetDetail', { status: indexability.canonical_target_status || i18n.t('auditProblems.unknown') }), severity: 'error' });
  }
  if (indexability?.canonical_target_check_error) problems.push({ id: 'metadata-canonical-unverified', label: i18n.t('auditProblems.metadata.canonicalUnverified'), detail: indexability.canonical_target_check_error, severity: 'warning' });
  if (!meta.viewport) problems.push({ id: 'metadata-viewport-missing', label: i18n.t('auditProblems.metadata.viewportMissing'), detail: i18n.t('auditProblems.metadata.viewportMissingDetail'), severity: 'error' });
  if (hasNoIndexDirective(meta.robots) || indexability?.status === 'blocked') problems.push({ id: 'metadata-indexing-blocked', label: i18n.t('auditProblems.metadata.indexingBlocked'), detail: indexability?.reasons.join(' ') || i18n.t('auditProblems.metadata.robotsDirective', { value: meta.robots }), severity: 'error' });

  return problems;
};

export const getSocialProblems = (audit: PageAuditData): AuditProblem[] => {
  const { open_graph: og, twitter_card: twitter } = audit;
  const problems: AuditProblem[] = [];

  if (!og.og_title) problems.push({ id: 'social-og-title', label: i18n.t('auditProblems.social.ogTitle'), detail: i18n.t('auditProblems.social.ogTitleDetail'), severity: 'warning' });
  if (!og.og_description) problems.push({ id: 'social-og-description', label: i18n.t('auditProblems.social.ogDescription'), detail: i18n.t('auditProblems.social.ogDescriptionDetail'), severity: 'warning' });
  if (!og.og_image) problems.push({ id: 'social-og-image', label: i18n.t('auditProblems.social.ogImage'), detail: i18n.t('auditProblems.social.ogImageDetail'), severity: 'warning' });
  if (!twitter.twitter_card) problems.push({ id: 'social-twitter-card', label: i18n.t('auditProblems.social.twitterCard'), detail: i18n.t('auditProblems.social.twitterCardDetail'), severity: 'warning' });
  if (!twitter.twitter_title) problems.push({ id: 'social-twitter-title', label: i18n.t('auditProblems.social.twitterTitle'), detail: i18n.t('auditProblems.social.twitterTitleDetail'), severity: 'warning' });
  if (!twitter.twitter_description) problems.push({ id: 'social-twitter-description', label: i18n.t('auditProblems.social.twitterDescription'), detail: i18n.t('auditProblems.social.twitterDescriptionDetail'), severity: 'warning' });
  if (!twitter.twitter_image) problems.push({ id: 'social-twitter-image', label: i18n.t('auditProblems.social.twitterImage'), detail: i18n.t('auditProblems.social.twitterImageDetail'), severity: 'warning' });

  return problems;
};

export const getStructuredDataProblems = (audit: PageAuditData): AuditProblem[] => {
  const findings = audit.structured_data.flatMap((item, itemIndex) => (item.validation_issues || [])
    .filter((finding) => finding.severity === 'error' || finding.severity === 'warning')
    .map((finding, findingIndex) => {
      const localized = localizeStructuredDataFinding(finding, {
        format: item.format,
        dataType: item.data_type,
      }, i18n.t.bind(i18n));
      const evidence = `${item.format} · ${item.data_type}${finding.path ? ` · ${finding.path}` : ''}: ${localized.evidenceMessage}${localized.evidenceRecommendation ? ` ${localized.evidenceRecommendation}` : ''}`;
      return {
        id: `structured-data-${itemIndex}-${findingIndex}-${finding.code}`,
        label: finding.severity === 'error' ? i18n.t('auditProblems.structured.error') : i18n.t('auditProblems.structured.warning'),
        detail: `${item.format} · ${item.data_type}${finding.path ? ` · ${finding.path}` : ''}: ${localized.displayMessage}${localized.displayRecommendation ? ` ${localized.displayRecommendation}` : ''}`,
        evidence,
        severity: finding.severity === 'error' ? 'error' as const : 'warning' as const,
      };
    }));
  if (!audit.structured_data.length) {
    return [{ id: 'structured-data-missing', label: i18n.t('auditProblems.structured.missing'), detail: i18n.t('auditProblems.structured.missingDetail'), severity: 'warning' }, ...findings];
  }
  return findings;
};

export const getAmpProblems = (audit: PageAuditData): AuditProblem[] => (audit.amp?.findings || [])
  .filter((finding) => finding.severity === 'error' || finding.severity === 'warning')
  .map((finding) => {
    const localized = localizeAmpFinding(finding, i18n.t.bind(i18n));
    return {
      id: `amp-${finding.code}`,
      label: localized.displayMessage,
      detail: localized.displayRecommendation
        ? `${i18n.t('auditProblems.recommendation')}: ${localized.displayRecommendation}`
        : i18n.t('ampFindings.reviewSource'),
      evidence: `${localized.evidenceMessage}${localized.evidenceRecommendation ? ` ${localized.evidenceRecommendation}` : ''}${finding.evidence ? ` ${finding.evidence}` : ''}`,
      severity: finding.severity === 'error' ? 'error' as const : 'warning' as const,
    };
  });
