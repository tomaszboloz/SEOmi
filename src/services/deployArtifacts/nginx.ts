import { rulePath } from './rules';
import type { ArtifactFile, RedirectRule, RuleIssue } from './types';

const quote = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/** Exact-match `location =` blocks: literal paths, no regex, safe for special characters. Put inside `server { }`. */
export const buildNginx = (rules: RedirectRule[]): ArtifactFile => {
  const skipped: RuleIssue[] = [];
  const lines = ['# SEOmi redirects (include inside server { })'];
  for (const rule of rules) {
    const path = rulePath(rule.from);
    if (path === null) { skipped.push({ kind: 'query-unsupported', from: rule.from }); continue; }
    const action = rule.status === 410 ? 'return 410;' : `return 301 ${quote(`${rule.to}`.replace(/\$/g, '%24'))};`;
    lines.push(`location = ${quote(path)} { ${action} }`);
  }
  return { name: 'nginx-redirects.conf', content: `${lines.join('\n')}\n`, skipped };
};
