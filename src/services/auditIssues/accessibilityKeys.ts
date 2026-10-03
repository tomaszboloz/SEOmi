interface IssueTranslationKeys {
  message: string;
  recommendation: string;
}

/**
 * Accessibility findings are produced by the HTML parser with a stable code,
 * but their source message/recommendation is intentionally kept in the audit
 * for backwards-compatible exports. Resolve those codes through the shared
 * accessibility namespace so persisted audits follow the active locale too.
 * The evidence keys are used for the five findings which predate the generic
 * finding-message namespace; they still provide a localized, actionable
 * summary and the detailed DOM evidence remains in the Accessibility panel.
 */
export const accessibilityTranslationKeys: Record<string, IssueTranslationKeys> = {
  'accessibility-document-language-missing': {
    message: 'accessibility.findingMessages.documentLanguageMissing',
    recommendation: 'accessibility.findingRecommendations.documentLanguageMissing',
  },
  'accessibility-document-language-invalid': {
    message: 'accessibility.findingMessages.documentLanguageInvalid',
    recommendation: 'accessibility.findingRecommendations.documentLanguageInvalid',
  },
  'accessibility-main-landmark-missing': {
    message: 'accessibility.findingMessages.mainLandmarkMissing',
    recommendation: 'accessibility.findingRecommendations.mainLandmarkMissing',
  },
  'accessibility-multiple-main-landmarks': {
    message: 'accessibility.findingMessages.multipleMainLandmarks',
    recommendation: 'accessibility.findingRecommendations.multipleMainLandmarks',
  },
  'accessibility-antispam-control-not-text': {
    message: 'accessibility.findingEvidence.antispamNonText',
    recommendation: 'accessibility.findingRecommendations.antispamNonText',
  },
  'accessibility-form-controls-unlabeled': {
    message: 'accessibility.findingMessages.unlabeledControls',
    recommendation: 'accessibility.findingRecommendations.unlabeledControls',
  },
  'accessibility-duplicate-id': {
    message: 'accessibility.findingEvidence.duplicateId',
    recommendation: 'accessibility.findingRecommendations.duplicateId',
  },
  'accessibility-aria-reference-unresolved': {
    message: 'accessibility.findingEvidence.ariaReference',
    recommendation: 'accessibility.findingRecommendations.ariaReference',
  },
  'accessibility-interactive-name-missing': {
    message: 'accessibility.findingEvidence.interactiveName',
    recommendation: 'accessibility.findingRecommendations.interactiveName',
  },
  'accessibility-focusable-aria-hidden': {
    message: 'accessibility.findingMessages.focusableAriaHidden',
    recommendation: 'accessibility.findingRecommendations.focusableAriaHidden',
  },
  'accessibility-image-alt-missing': {
    message: 'accessibility.findingEvidence.imageAlt',
    recommendation: 'accessibility.findingRecommendations.imageAlt',
  },
};

