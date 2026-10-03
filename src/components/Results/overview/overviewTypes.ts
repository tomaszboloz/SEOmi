import type { IssueCategory, PageAuditData } from "@/types";

export interface OverviewProps {
  audit: PageAuditData;
}

export const issueCategoryTranslationKeys: Record<IssueCategory, string> = {
  MetaTags: "metaIIndeksacja",
  OpenGraph: "openGraph",
  TwitterCard: "twitterCard",
  Headings: "nagOwki",
  Images: "obrazy",
  Links: "linki",
  Security: "bezpieczenstwo",
  Performance: "performance",
  Technical: "techniczne",
  StructuredData: "daneStrukturalne",
};

export const accessibilitySelectorForCode = (code?: string): string => {
  switch (code) {
    case "accessibility-interactive-name-missing":
      return "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']";
    case "accessibility-focusable-aria-hidden":
      return "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    case "accessibility-image-alt-missing":
      return "img:not([alt])";
    case "accessibility-duplicate-id":
      return "[id]";
    case "accessibility-aria-reference-unresolved":
      return "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]";
    case "accessibility-document-language-invalid":
      return "html";
    case "accessibility-multiple-main-landmarks":
      return "main, [role='main']";
    case "accessibility-form-controls-unlabeled":
    case "accessibility-antispam-control-not-text":
      return "input, select, textarea";
    default:
      return "input, select, textarea";
  }
};

export const accessibilityEvidenceLabelKey = (code?: string): string => {
  switch (code) {
    case "accessibility-interactive-name-missing":
      return "accessibility.interactiveElement";
    case "accessibility-focusable-aria-hidden":
      return "accessibility.focusableAriaHidden";
    case "accessibility-image-alt-missing":
      return "accessibility.image";
    case "accessibility-duplicate-id":
      return "accessibility.duplicateId";
    case "accessibility-aria-reference-unresolved":
      return "accessibility.ariaReference";
    case "accessibility-document-language-invalid":
      return "accessibility.htmlLanguageElement";
    case "accessibility-multiple-main-landmarks":
      return "accessibility.mainLandmark";
    case "accessibility-form-controls-unlabeled":
    case "accessibility-antispam-control-not-text":
      return "accessibility.formControl";
    default:
      return "accessibility.formControl";
  }
};
