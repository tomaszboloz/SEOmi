import { expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import type { AccessibilityFinding } from '@/types';
import { accessibilityFindingMessage, accessibilityFindingRecommendation, accessibilityFindingEvidence, accessibilityManualReview, technologyCategory } from '@/components/Results/metadata/metadataHelpers';
import { createAuditFixture } from './fixtures/audit';

const finding = (code: string, patch: Partial<AccessibilityFinding> = {}): AccessibilityFinding => ({ code, severity: 'warning', message: 'Original message', evidence: 'Original evidence', recommendation: 'Original recommendation', ...patch });
const translator = () => {
  const spy = vi.fn((key: string) => `translated:${key}`);
  return { spy, t: spy as unknown as TFunction };
};

it.each([
  ['accessibility-document-language-missing', 'documentLanguageMissing'],
  ['accessibility-document-language-invalid', 'documentLanguageInvalid'],
  ['accessibility-main-landmark-missing', 'mainLandmarkMissing'],
])('localizes %s message and evidence', (code, suffix) => {
  const { spy, t } = translator();
  const item = finding(code, { evidence: 'LaNg=zz' });
  expect(accessibilityFindingMessage(item, createAuditFixture(), t)).toBe(`translated:accessibility.findingMessages.${suffix}`);
  expect(spy).toHaveBeenCalledWith(`accessibility.findingMessages.${suffix}`);
  expect(accessibilityFindingEvidence(item, createAuditFixture(), t)).toBe(`translated:accessibility.findingEvidence.${suffix}`);
  if (suffix === 'documentLanguageInvalid') expect(spy).toHaveBeenCalledWith(`accessibility.findingEvidence.${suffix}`, { value: 'zz' });
});

it.each([
  ['accessibility-document-language-missing', 'documentLanguageMissing'], ['accessibility-document-language-invalid', 'documentLanguageInvalid'],
  ['accessibility-main-landmark-missing', 'mainLandmarkMissing'], ['accessibility-multiple-main-landmarks', 'multipleMainLandmarks'],
  ['accessibility-antispam-control-not-text', 'antispamNonText'], ['accessibility-form-controls-unlabeled', 'unlabeledControls'],
  ['accessibility-duplicate-id', 'duplicateId'], ['accessibility-aria-reference-unresolved', 'ariaReference'],
  ['accessibility-interactive-name-missing', 'interactiveName'], ['accessibility-focusable-aria-hidden', 'focusableAriaHidden'],
  ['accessibility-image-alt-missing', 'imageAlt'],
])('localizes %s recommendation', (code, suffix) => {
  const { spy, t } = translator();
  expect(accessibilityFindingRecommendation(finding(code), t)).toBe(`translated:accessibility.findingRecommendations.${suffix}`);
  expect(spy).toHaveBeenCalledWith(`accessibility.findingRecommendations.${suffix}`);
});

it('preserves unknown finding text/evidence/recommendation without invoking translation', () => {
  const { spy, t } = translator();
  const item = finding('provider-new-code');
  expect(accessibilityFindingMessage(item, createAuditFixture(), t)).toBe('Original message');
  expect(accessibilityFindingEvidence(item, createAuditFixture(), t)).toBe('Original evidence');
  expect(accessibilityFindingRecommendation(item, t)).toBe('Original recommendation');
  expect(spy).not.toHaveBeenCalled();
});

it.each([
  ['accessibility-antispam-control-not-text', 'antispamNonText', 'prefix: retained', undefined],
  ['accessibility-duplicate-id', 'duplicateId', 'Duplicate:  #one ', '#one'],
  ['accessibility-interactive-name-missing', 'interactiveName', 'Button：  <button> ', '<button>'],
  ['accessibility-duplicate-id', 'duplicateId', '  unchanged  ', 'unchanged'],
  ['accessibility-aria-reference-unresolved', 'ariaReference', 'prefix: #missing', 'prefix: #missing'],
])('keeps the evidence value contract for %s', (code, suffix, evidence, value) => {
  const { spy, t } = translator();
  expect(accessibilityFindingEvidence(finding(code, { evidence }), createAuditFixture(), t)).toBe(`translated:accessibility.findingEvidence.${suffix}`);
  if (value === undefined) expect(spy).toHaveBeenCalledWith(`accessibility.findingEvidence.${suffix}`);
  else expect(spy).toHaveBeenCalledWith(`accessibility.findingEvidence.${suffix}`, { value });
});

it('translates the three manual checks and retains additional provider items in order', () => {
  const { spy, t } = translator();
  expect(accessibilityManualReview([], t)).toBe('');
  expect(accessibilityManualReview(['raw contrast', 'raw keyboard', 'raw aria', 'Extra evidence'], t)).toBe('translated:accessibility.manualReview.contrast translated:accessibility.manualReview.keyboard translated:accessibility.manualReview.ariaTree Extra evidence');
  expect(spy.mock.calls.map(([key]) => key)).toEqual(['accessibility.manualReview.contrast', 'accessibility.manualReview.keyboard', 'accessibility.manualReview.ariaTree']);
});

it.each([
  ['CMS / platform', 'cmsPlatform'], ['CMS / generator', 'cmsGenerator'], ['CMS', 'cms'], ['Commerce platform', 'commercePlatform'],
  ['JavaScript framework', 'javascriptFramework'], ['Tag manager', 'tagManager'], ['Analytics / tag', 'analyticsTag'],
  ['JavaScript library', 'javascriptLibrary'], ['CSS / UI framework', 'cssFramework'], ['Analytics', 'analytics'],
])('localizes known technology category %s with original fallback', (category, suffix) => {
  const { spy, t } = translator();
  expect(technologyCategory(category, t)).toBe(`translated:legacyUi.metadata.technologyCategories.${suffix}`);
  expect(spy).toHaveBeenCalledWith(`legacyUi.metadata.technologyCategories.${suffix}`, { defaultValue: category });
});

it('preserves unknown technology categories without guessing a translated name', () => {
  const { spy, t } = translator();
  expect(technologyCategory('New technology', t)).toBe('New technology');
  expect(spy).not.toHaveBeenCalled();
});
