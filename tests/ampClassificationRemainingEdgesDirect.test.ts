import { describe, expect, it } from 'vitest';
import { localizeAmpFinding } from '@/services/ampIssueLocalization';
import i18n from '@/i18n';

describe('AMP code classification preserves measured evidence', () => {
  it.each([
    ['amp-over-budget', 'Truncated'], ['amp-multiple-canonical', 'Duplicate'],
    ['amp-css-import', 'Invalid'], ['amp-event-handler', 'Invalid'],
    ['amp-not-allowed', 'Invalid'], ['amp-not-allowlisted', 'Invalid'],
  ])('classifies %s using %s messages', (code, kind) => {
    const finding = {
      code, severity: 'warning', message: 'Observed source evidence',
      evidence: '<node>', recommendation: 'Review source element',
    };
    const snapshot = { ...finding };
    expect(localizeAmpFinding(finding, i18n.t.bind(i18n))).toEqual({
      displayMessage: i18n.t(`ampFindings.message${kind}`, { code, severity: 'warning' }),
      displayRecommendation: i18n.t('ampFindings.recommendation', { code, severity: 'warning' }),
      evidenceMessage: finding.message, evidenceRecommendation: finding.recommendation,
    });
    expect(finding).toEqual(snapshot);
  });
});
