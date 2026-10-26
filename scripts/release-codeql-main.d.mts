export interface CodeqlEvidence {
  status: 'success' | 'pending';
  sha?: string;
  analysisIds?: number[];
  openAlerts?: number;
  reason?: string;
}
export function evaluateMainCodeqlEvidence(options: {
  sha: string;
  head: unknown;
  analyses: unknown;
  alerts: unknown;
}): CodeqlEvidence;
export function loadMainCodeqlEvidence(options: {
  apiUrl?: string;
  repository: string;
  sha: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<CodeqlEvidence>;
