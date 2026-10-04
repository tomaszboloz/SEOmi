import { expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import type { AccessibilityFinding } from '@/types';
import { accessibilityFindingMessage, accessibilityFindingEvidence } from '@/components/Results/metadata/metadataHelpers';
import { createAuditFixture } from './fixtures/audit';

const item = (code: string, message: string, count?: number): AccessibilityFinding => ({
  code, severity: 'warning', message, evidence: 'Original', recommendation: 'Original',
  ...(count === undefined ? {} : { elements: Array.from({ length: count }, (_, dom_position) => ({ dom_position, dom_query: 'button', html_snippet: '<button>' })) }),
});

it.each([
  ['3 landmarks', 2, 2], ['3 landmarks', undefined, 3], ['no count', 0, 0], ['no count', undefined, 0],
] as const)('multiple landmarks count uses element evidence before message %s/%s', (message, count, expected) => {
  const spy = vi.fn((key: string) => key);
  const t = spy as unknown as TFunction;
  const finding = item('accessibility-multiple-main-landmarks', message, count);
  expect(accessibilityFindingMessage(finding, createAuditFixture(), t)).toBe('accessibility.findingMessages.multipleMainLandmarks');
  expect(accessibilityFindingEvidence(finding, createAuditFixture(), t)).toBe('accessibility.findingEvidence.multipleMainLandmarks');
  expect(spy).toHaveBeenCalledWith('accessibility.findingMessages.multipleMainLandmarks', { count: expected });
  expect(spy).toHaveBeenCalledWith('accessibility.findingEvidence.multipleMainLandmarks', { count: expected });
});

it.each([
  ['4 focusable elements', 2, 4], ['no count', 2, 2], ['no count', undefined, 0], ['no count', 0, 0],
] as const)('focusable count uses the observed message then element evidence %s/%s', (message, count, expected) => {
  const spy = vi.fn((key: string) => key);
  const t = spy as unknown as TFunction;
  const finding = item('accessibility-focusable-aria-hidden', message, count);
  accessibilityFindingMessage(finding, createAuditFixture(), t);
  accessibilityFindingEvidence(finding, createAuditFixture(), t);
  expect(spy).toHaveBeenCalledWith('accessibility.findingMessages.focusableAriaHidden', { count: expected });
  expect(spy).toHaveBeenCalledWith('accessibility.findingEvidence.focusableAriaHidden', { count: expected });
});

it.each([['5 images', 2, 5], ['unknown', 2, 2], ['unknown', undefined, 0], ['unknown', 0, 0]] as const)('image evidence count is retained for %s/%s', (message, count, expected) => {
  const spy = vi.fn((key: string) => key);
  accessibilityFindingEvidence(item('accessibility-image-alt-missing', message, count), createAuditFixture(), spy as unknown as TFunction);
  expect(spy).toHaveBeenCalledWith('accessibility.findingEvidence.imageAlt', { count: expected });
});

it.each([false, true])('unlabeled controls retain measured counts or honest missing-data zeros: %s', (available) => {
  const audit = createAuditFixture();
  if (available) audit.accessibility = { landmarks: [], aria_attribute_count: 0, form_control_count: 9, unlabeled_form_control_count: 3, manual_review_items: [] };
  const spy = vi.fn((key: string) => key);
  const t = spy as unknown as TFunction;
  const finding = item('accessibility-form-controls-unlabeled', 'provider message');
  accessibilityFindingMessage(finding, audit, t);
  accessibilityFindingEvidence(finding, audit, t);
  const values = { unlabeled: available ? 3 : 0, total: available ? 9 : 0 };
  expect(spy).toHaveBeenCalledWith('accessibility.findingMessages.unlabeledControls', values);
  expect(spy).toHaveBeenCalledWith('accessibility.findingEvidence.unlabeledControls', values);
});
