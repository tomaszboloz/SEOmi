import { AccessibilityFinding, PageAuditData } from '@/types';
import { TFunction } from 'i18next';

export const accessibilityFindingMessage = (finding: AccessibilityFinding, audit: PageAuditData, t: TFunction): string => {
  switch (finding.code) {
    case 'accessibility-document-language-missing':
      return t('accessibility.findingMessages.documentLanguageMissing');
    case 'accessibility-document-language-invalid':
      return t('accessibility.findingMessages.documentLanguageInvalid');
    case 'accessibility-main-landmark-missing':
      return t('accessibility.findingMessages.mainLandmarkMissing');
    case 'accessibility-multiple-main-landmarks':
      return t('accessibility.findingMessages.multipleMainLandmarks', {
        count: finding.elements?.length || Number(finding.message.match(/\d+/)?.[0] || 0),
      });
    case 'accessibility-form-controls-unlabeled':
      return t('accessibility.findingMessages.unlabeledControls', {
        unlabeled: audit.accessibility?.unlabeled_form_control_count ?? 0,
        total: audit.accessibility?.form_control_count ?? 0,
      });
    case 'accessibility-focusable-aria-hidden':
      return t('accessibility.findingMessages.focusableAriaHidden', {
        count: Number(finding.message.match(/\d+/)?.[0] || finding.elements?.length || 0),
      });
    default:
      return finding.message;
  }
};

export const accessibilityFindingRecommendation = (finding: AccessibilityFinding, t: TFunction): string => {
  const keyByCode: Record<string, string> = {
    'accessibility-document-language-missing': 'accessibility.findingRecommendations.documentLanguageMissing',
    'accessibility-document-language-invalid': 'accessibility.findingRecommendations.documentLanguageInvalid',
    'accessibility-main-landmark-missing': 'accessibility.findingRecommendations.mainLandmarkMissing',
    'accessibility-multiple-main-landmarks': 'accessibility.findingRecommendations.multipleMainLandmarks',
    'accessibility-antispam-control-not-text': 'accessibility.findingRecommendations.antispamNonText',
    'accessibility-form-controls-unlabeled': 'accessibility.findingRecommendations.unlabeledControls',
    'accessibility-duplicate-id': 'accessibility.findingRecommendations.duplicateId',
    'accessibility-aria-reference-unresolved': 'accessibility.findingRecommendations.ariaReference',
    'accessibility-interactive-name-missing': 'accessibility.findingRecommendations.interactiveName',
    'accessibility-focusable-aria-hidden': 'accessibility.findingRecommendations.focusableAriaHidden',
    'accessibility-image-alt-missing': 'accessibility.findingRecommendations.imageAlt',
  };
  const key = keyByCode[finding.code];
  return key ? t(key) : finding.recommendation;
};

export const accessibilityFindingEvidence = (finding: AccessibilityFinding, audit: PageAuditData, t: TFunction): string => {
  const stripPrefix = (value: string): string => value.replace(/^[^:：]+[:：]\s*/, '').trim();
  switch (finding.code) {
    case 'accessibility-document-language-missing':
      return t('accessibility.findingEvidence.documentLanguageMissing');
    case 'accessibility-document-language-invalid':
      return t('accessibility.findingEvidence.documentLanguageInvalid', { value: finding.evidence.replace(/^lang=/i, '') });
    case 'accessibility-main-landmark-missing':
      return t('accessibility.findingEvidence.mainLandmarkMissing');
    case 'accessibility-multiple-main-landmarks':
      return t('accessibility.findingEvidence.multipleMainLandmarks', { count: finding.elements?.length || Number(finding.message.match(/\d+/)?.[0] || 0) });
    case 'accessibility-antispam-control-not-text':
      return t('accessibility.findingEvidence.antispamNonText');
    case 'accessibility-form-controls-unlabeled':
      return t('accessibility.findingEvidence.unlabeledControls', {
        unlabeled: audit.accessibility?.unlabeled_form_control_count ?? 0,
        total: audit.accessibility?.form_control_count ?? 0,
      });
    case 'accessibility-duplicate-id':
      return t('accessibility.findingEvidence.duplicateId', { value: stripPrefix(finding.evidence) });
    case 'accessibility-aria-reference-unresolved':
      return t('accessibility.findingEvidence.ariaReference', { value: finding.evidence });
    case 'accessibility-interactive-name-missing':
      return t('accessibility.findingEvidence.interactiveName', { value: stripPrefix(finding.evidence) });
    case 'accessibility-focusable-aria-hidden':
      return t('accessibility.findingEvidence.focusableAriaHidden', { count: Number(finding.message.match(/\d+/)?.[0] || finding.elements?.length || 0) });
    case 'accessibility-image-alt-missing':
      return t('accessibility.findingEvidence.imageAlt', { count: Number(finding.message.match(/\d+/)?.[0] || finding.elements?.length || 0) });
    default:
      return finding.evidence;
  }
};

export const accessibilityManualReview = (items: string[], t: TFunction): string => items.map((item, index) => {
  const key = ['contrast', 'keyboard', 'ariaTree'][index];
  return key ? t(`accessibility.manualReview.${key}`) : item;
}).join(' ');

export const technologyCategoryKey: Record<string, string> = {
  'CMS / platform': 'legacyUi.metadata.technologyCategories.cmsPlatform',
  'CMS / generator': 'legacyUi.metadata.technologyCategories.cmsGenerator',
  CMS: 'legacyUi.metadata.technologyCategories.cms',
  'Commerce platform': 'legacyUi.metadata.technologyCategories.commercePlatform',
  'JavaScript framework': 'legacyUi.metadata.technologyCategories.javascriptFramework',
  'Tag manager': 'legacyUi.metadata.technologyCategories.tagManager',
  'Analytics / tag': 'legacyUi.metadata.technologyCategories.analyticsTag',
  'JavaScript library': 'legacyUi.metadata.technologyCategories.javascriptLibrary',
  'CSS / UI framework': 'legacyUi.metadata.technologyCategories.cssFramework',
  Analytics: 'legacyUi.metadata.technologyCategories.analytics',
};

export const technologyCategory = (category: string, t: TFunction): string => {
  const key = technologyCategoryKey[category];
  return key ? t(key, { defaultValue: category }) : category;
};
