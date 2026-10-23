import { csvRows } from './csv';
import type { ArtifactFile, RedirectRule, RuleIssue } from './types';

/** Cloudflare Bulk Redirects: source has no scheme; the product supports 301/302/307/308 only, so 410 rules are reported, not exported. */
export const buildCloudflareCsv = (rules: RedirectRule[]): ArtifactFile => {
  const skipped: RuleIssue[] = [];
  const rows: Array<Array<string | number | boolean>> = [];
  for (const rule of rules) {
    if (rule.status === 410 || !rule.to) { skipped.push({ kind: 'gone-unsupported', from: rule.from }); continue; }
    rows.push([rule.from.replace(/^https?:\/\//, ''), rule.to, 301, false, false, false, false]);
  }
  return { name: 'cloudflare-bulk-redirects.csv', content: csvRows(rows), skipped };
};
