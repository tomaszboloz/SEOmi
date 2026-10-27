export type RuleStatus = 301 | 410;

/** A redirect or removal rule. `from` and `to` are absolute http(s) URLs. */
export interface RedirectRule {
  from: string;
  /** Destination; null for 410 Gone. */
  to: string | null;
  status: RuleStatus;
}

export type RuleIssueKind = 'invalid' | 'duplicate' | 'loop' | 'chain-flattened' | 'dead-target' | 'query-unsupported' | 'gone-unsupported';

export interface RuleIssue {
  kind: RuleIssueKind;
  from: string;
}

export interface ValidatedRules {
  rules: RedirectRule[];
  issues: RuleIssue[];
}

export interface ArtifactFile {
  name: string;
  content: string;
  /** Rules that cannot be expressed in this format. */
  skipped?: RuleIssue[];
}
