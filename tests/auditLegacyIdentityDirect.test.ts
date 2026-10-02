import type { TFunction } from 'i18next';
import { expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { localizeAuditIssue } from '@/services/auditIssueLocalization';
import type { Issue } from '@/types';

it('recognizes case-insensitive legacy accessibility codes', () => {
  const issue: Issue = { category: 'Technical', severity: 'Warning',
    message: 'Accessibility · ACCESSIBILITY-FORM-CONTROLS-UNLABELED: 4 of 14 controls' };
  expect(localizeAuditIssue(issue, i18n.t.bind(i18n)).displayMessage).toContain('4 of 14');
  expect(localizeAuditIssue(issue, i18n.t.bind(i18n)).displayMessage).not.toContain('ACCESSIBILITY-');
});

it('preserves unrecognized messages and absent recommendations', () => {
  const issue: Issue = { category: 'Technical', severity: 'Info', message: 'Custom message' };
  expect(localizeAuditIssue(issue, i18n.t.bind(i18n))).toEqual({ ...issue,
    displayMessage: 'Custom message', displayRecommendation: undefined });
});
it('keeps unknown stable-code messages and recommendations as fallback', () => {
  const issue: Issue = { category: 'Technical', severity: 'Info', code: 'future_code',
    message: 'Custom message', recommendation: 'Custom action' };
  expect(localizeAuditIssue(issue, i18n.t.bind(i18n))).toEqual({ ...issue,
    displayMessage: 'Custom message', displayRecommendation: 'Custom action' });
});
it('preserves a recommendation on an unrecognized legacy issue', () => {
  const issue: Issue = { category: 'Technical', severity: 'Info', message: 'Custom', recommendation: 'Action' };
  expect(localizeAuditIssue(issue, i18n.t.bind(i18n)).displayRecommendation).toBe('Action');
});
it('explicit parameters override inferred legacy interpolation without mutating input', () => {
  const issue: Issue = { category: 'MetaTags', severity: 'Warning',
    message: 'Page title is too short (5 characters)', params: { count: '12' }, recommendation: 'Extend title' };
  const result = localizeAuditIssue(issue, i18n.t.bind(i18n));
  expect(result.displayMessage).toContain('12');
  expect(result.displayRecommendation).not.toBe('Extend title');
  expect(issue.params).toEqual({ count: '12' });
  expect(issue.message).toBe('Page title is too short (5 characters)');
});
it('infers a legacy identity when an optional stable code is empty', () => {
  const issue: Issue = { category: 'MetaTags', severity: 'Warning', code: '',
    message: 'Page title is too short (5 characters)', recommendation: 'Extend title' };
  const t = vi.fn(() => 'translated');
  const result = localizeAuditIssue(issue, t as unknown as TFunction);
  expect(result.displayMessage).not.toBe(issue.message);
  expect(t).toHaveBeenCalledWith('auditIssues.messages.meta_title_short', { count: '5', defaultValue: issue.message });
  expect(t).toHaveBeenCalledWith('auditIssues.recommendations.meta_title_short', { count: '5', defaultValue: issue.recommendation });
  expect(result.displayRecommendation).not.toBe(issue.recommendation);
});
