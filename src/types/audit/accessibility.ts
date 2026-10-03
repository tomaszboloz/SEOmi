export interface AccessibilityLandmark {
  name: string;
  count: number;
}

export interface AccessibilityFinding {
  code: string;
  severity: string;
  message: string;
  evidence: string;
  recommendation: string;
  elements?: AccessibilityElementEvidence[];
}

export interface AccessibilityElementEvidence {
  dom_position: number;
  dom_query: string;
  html_snippet: string;
  line?: number;
  column?: number;
}

export interface AccessibilityAudit {
  document_language?: string;
  landmarks: AccessibilityLandmark[];
  aria_attribute_count: number;
  form_control_count: number;
  unlabeled_form_control_count: number;
  hidden_form_control_count?: number;
  hidden_form_controls?: AccessibilityElementEvidence[];
  anti_spam_text_control_count?: number;
  anti_spam_text_controls?: AccessibilityElementEvidence[];
  findings?: AccessibilityFinding[];
  manual_review_items: string[];
}
