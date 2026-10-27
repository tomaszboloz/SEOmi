import { rulePath } from './rules';
import type { ArtifactFile, RedirectRule, RuleIssue } from './types';

const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quote = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/** mod_alias RedirectMatch with an anchored, escaped pattern so `/a` never captures `/a/child`. */
export const buildHtaccess = (rules: RedirectRule[]): ArtifactFile => {
  const skipped: RuleIssue[] = [];
  const lines = ['# SEOmi redirects (mod_alias)'];
  for (const rule of rules) {
    const path = rulePath(rule.from);
    if (path === null) { skipped.push({ kind: 'query-unsupported', from: rule.from }); continue; }
    const pattern = quote(`^${regexEscape(path)}$`);
    lines.push(rule.status === 410 ? `RedirectMatch 410 ${pattern}` : `RedirectMatch 301 ${pattern} ${quote(`${rule.to}`.replace(/\$/g, '%24'))}`);
  }
  return { name: '.htaccess', content: `${lines.join('\n')}\n`, skipped };
};
