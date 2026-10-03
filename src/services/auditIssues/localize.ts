import type { TFunction } from 'i18next';
import type { Issue } from '@/types';
import { accessibilityTranslationKeys } from './accessibilityKeys';
import { inferLegacyIssueIdentity } from './legacyIdentity';

/**
 * Resolve a backend audit finding through the active locale. The backend keeps
 * the original message so old projects and exports remain readable; new
 * records additionally carry a stable code and interpolation values.
 */
export const localizeAuditIssue = (issue: Issue, t: TFunction): Issue & {
  displayMessage: string;
  displayRecommendation?: string;
} => {
  const inferred = issue.code ? null : inferLegacyIssueIdentity(issue);
  const code = issue.code || inferred?.code;
  const params = { ...(inferred?.params ?? {}), ...(issue.params ?? {}) };
  const accessibilityKeys = code ? accessibilityTranslationKeys[code] : undefined;
  const messageKey = accessibilityKeys?.message ?? (code ? `auditIssues.messages.${code}` : '');
  const recommendationKey = accessibilityKeys?.recommendation ?? (code ? `auditIssues.recommendations.${code}` : '');
  const displayMessage = code
    ? t(messageKey, { ...params, defaultValue: issue.message })
    : issue.message;
  const displayRecommendation = issue.recommendation
    ? issue.code
      ? t(recommendationKey, { ...params, defaultValue: issue.recommendation })
      : inferred
        ? t(recommendationKey, { ...params, defaultValue: issue.recommendation })
      : issue.recommendation
    : undefined;

  return { ...issue, displayMessage, displayRecommendation };
};
