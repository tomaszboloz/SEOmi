import { describe, expect, it } from 'vitest';
import {
  accessibilityFindingEvidence, accessibilityFindingMessage, accessibilityFindingRecommendation,
  accessibilityManualReview, technologyCategory, technologyCategoryKey,
} from '@/components/Results/metadata/metadataHelpers';
import type { AccessibilityFinding, PageAuditData } from '@/types';

// Echo key and parameters so every branch's translation call is observable.
const t = ((key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(Object.fromEntries(Object.entries(options).filter(([name]) => name !== 'defaultValue')))}` : key)) as never;
const finding = (code: string, extra: Partial<AccessibilityFinding> = {}) => ({ code, message: 'msg', evidence: 'ev', recommendation: 'fallback', ...extra }) as AccessibilityFinding;
const audit = { accessibility: { unlabeled_form_control_count: 2, form_control_count: 5 } } as unknown as PageAuditData;
const bare = {} as PageAuditData;

describe('accessibilityFindingMessage', () => {
  it.each([
    ['accessibility-document-language-missing', 'accessibility.findingMessages.documentLanguageMissing'],
    ['accessibility-document-language-invalid', 'accessibility.findingMessages.documentLanguageInvalid'],
    ['accessibility-main-landmark-missing', 'accessibility.findingMessages.mainLandmarkMissing'],
  ])('maps %s to a plain message', (code, key) => expect(accessibilityFindingMessage(finding(code), audit, t)).toBe(key));

  it('counts landmarks from elements, then the message, then zero', () => {
    const code = 'accessibility-multiple-main-landmarks';
    expect(accessibilityFindingMessage(finding(code, { elements: ['a', 'b'] as never }), audit, t)).toContain('"count":2');
    expect(accessibilityFindingMessage(finding(code, { message: '3 main elements' }), audit, t)).toContain('"count":3');
    expect(accessibilityFindingMessage(finding(code), audit, t)).toContain('"count":0');
  });

  it('reports unlabeled controls from the audit with zero defaults', () => {
    const code = 'accessibility-form-controls-unlabeled';
    expect(accessibilityFindingMessage(finding(code), audit, t)).toContain('{"unlabeled":2,"total":5}');
    expect(accessibilityFindingMessage(finding(code), bare, t)).toContain('{"unlabeled":0,"total":0}');
  });

  it('prefers the number in the message for aria-hidden focusables and falls back to the provider text', () => {
    const code = 'accessibility-focusable-aria-hidden';
    expect(accessibilityFindingMessage(finding(code, { message: '4 hidden', elements: ['x'] as never }), audit, t)).toContain('"count":4');
    expect(accessibilityFindingMessage(finding(code, { message: 'none', elements: ['x', 'y'] as never }), audit, t)).toContain('"count":2');
    expect(accessibilityFindingMessage(finding('accessibility-unknown', { message: 'Provider text' }), audit, t)).toBe('Provider text');
  });
});

describe('accessibilityFindingRecommendation', () => {
  it('translates known codes and keeps the provider recommendation otherwise', () => {
    expect(accessibilityFindingRecommendation(finding('accessibility-image-alt-missing'), t)).toBe('accessibility.findingRecommendations.imageAlt');
    expect(accessibilityFindingRecommendation(finding('accessibility-duplicate-id'), t)).toBe('accessibility.findingRecommendations.duplicateId');
    expect(accessibilityFindingRecommendation(finding('accessibility-unknown'), t)).toBe('fallback');
  });
});

describe('accessibilityFindingEvidence', () => {
  it('strips the lang= prefix and label prefixes (ASCII and full-width colon)', () => {
    expect(accessibilityFindingEvidence(finding('accessibility-document-language-invalid', { evidence: 'LANG=xx-yy' }), audit, t)).toContain('"value":"xx-yy"');
    expect(accessibilityFindingEvidence(finding('accessibility-duplicate-id', { evidence: 'Duplicate id: hero' }), audit, t)).toContain('"value":"hero"');
    expect(accessibilityFindingEvidence(finding('accessibility-interactive-name-missing', { evidence: 'Przycisk： #buy' }), audit, t)).toContain('"value":"#buy"');
    expect(accessibilityFindingEvidence(finding('accessibility-aria-reference-unresolved', { evidence: 'aria-labelledby=x' }), audit, t)).toContain('"value":"aria-labelledby=x"');
  });

  it.each([
    'accessibility-document-language-missing', 'accessibility-main-landmark-missing', 'accessibility-antispam-control-not-text',
  ])('uses a static translation for %s', (code) => expect(accessibilityFindingEvidence(finding(code), audit, t)).toMatch(/^accessibility\.findingEvidence\./));

  it('counts elements for landmarks, aria-hidden focusables and images', () => {
    const elements = ['a', 'b', 'c'] as never;
    expect(accessibilityFindingEvidence(finding('accessibility-multiple-main-landmarks', { elements }), audit, t)).toContain('"count":3');
    expect(accessibilityFindingEvidence(finding('accessibility-focusable-aria-hidden', { message: 'no digits', elements }), audit, t)).toContain('"count":3');
    expect(accessibilityFindingEvidence(finding('accessibility-image-alt-missing', { message: '7 images' }), audit, t)).toContain('"count":7');
    expect(accessibilityFindingEvidence(finding('accessibility-form-controls-unlabeled'), bare, t)).toContain('{"unlabeled":0,"total":0}');
    expect(accessibilityFindingEvidence(finding('accessibility-unknown', { evidence: 'raw' }), audit, t)).toBe('raw');
  });
});

describe('manual review and technology categories', () => {
  it('translates the first three manual-review items and keeps further ones as written', () => {
    expect(accessibilityManualReview(['a', 'b', 'c', 'Extra'], t)).toBe('accessibility.manualReview.contrast accessibility.manualReview.keyboard accessibility.manualReview.ariaTree Extra');
    expect(accessibilityManualReview([], t)).toBe('');
  });

  it('translates known categories and returns unknown ones unchanged', () => {
    for (const category of Object.keys(technologyCategoryKey)) expect(technologyCategory(category, t)).toContain(technologyCategoryKey[category]);
    expect(technologyCategory('Unknown kind', t)).toBe('Unknown kind');
  });
});
