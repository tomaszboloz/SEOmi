import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { localizeStructuredDataFinding } from '@/services/schemaIssueLocalization';
import type { StructuredDataValidationIssue } from '@/types';

describe('schemaIssueLocalization edge and fallback branches', () => {
  it('covers unsupported, not-detected, missing, and generic message kinds', () => {
    const context = { format: 'JSON-LD', dataType: 'Article' };

    const kinds: Array<{ code: string; expectedKind: string }> = [
      { code: 'unsupported-type', expectedKind: 'Unsupported' },
      { code: 'not-detected-syntax', expectedKind: 'NotDetected' },
      { code: 'non-schema-org', expectedKind: 'NotDetected' },
      { code: 'not-absolute-uri', expectedKind: 'Missing' },
      { code: 'arbitrary-generic-code', expectedKind: 'Generic' },
    ];

    for (const { code } of kinds) {
      const issue: StructuredDataValidationIssue = {
        code,
        severity: 'info',
        message: 'Original evidence message',
      };
      const localized = localizeStructuredDataFinding(issue, context, i18n.t.bind(i18n));
      expect(localized.evidenceMessage).toBe('Original evidence message');
      expect(localized.displaySeverity).toBe(i18n.t('schemaFindings.severityInfo'));
      expect(localized.displayRecommendation).toBeUndefined();
    }
  });

  it('handles error severity and missing path fallback', () => {
    const context = { format: 'Microdata', dataType: 'Organization' };
    const issue: StructuredDataValidationIssue = {
      code: 'name-missing',
      severity: 'error',
      message: 'Name is required',
      recommendation: 'Provide name',
    };

    const localized = localizeStructuredDataFinding(issue, context, i18n.t.bind(i18n));
    expect(localized.displaySeverity).toBe(i18n.t('schemaFindings.severityError'));
    expect(localized.displayRecommendation).toBeDefined();
    expect(localized.displayMessage).toBeDefined();
  });
});
