import type { RedirectRule, RuleIssue, ValidatedRules } from './types';

const MAX_HOPS = 20;

export const ruleKey = (value: string): string => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
};

/**
 * Validates and normalizes rules: drops invalid, duplicate and looping rules,
 * rewrites chains (A to B, B to C) to point straight at the final target,
 * and flags 301s that end on a URL that is itself gone (410).
 */
export const validateRules = (input: RedirectRule[]): ValidatedRules => {
  const issues: RuleIssue[] = [];
  const byFrom = new Map<string, RedirectRule>();
  for (const rule of input) {
    const from = ruleKey(rule.from);
    const to = rule.status === 301 && rule.to ? ruleKey(rule.to) : null;
    if (!from || (rule.status === 301 && !to) || (rule.status !== 301 && rule.status !== 410)) issues.push({ kind: 'invalid', from: rule.from });
    else if (byFrom.has(from)) issues.push({ kind: 'duplicate', from });
    else if (from === to) issues.push({ kind: 'loop', from });
    else byFrom.set(from, { from, to, status: rule.status });
  }
  const rules: RedirectRule[] = [];
  for (const rule of byFrom.values()) {
    let target = rule.to;
    let hops = 0;
    const seen = new Set([rule.from]);
    while (target && byFrom.get(target)?.status === 301 && hops++ < MAX_HOPS) {
      if (seen.has(target)) { target = null; break; }
      seen.add(target);
      target = byFrom.get(target)!.to;
    }
    if (rule.to && !target) { issues.push({ kind: 'loop', from: rule.from }); continue; }
    if (rule.status === 301 && target !== rule.to) issues.push({ kind: 'chain-flattened', from: rule.from });
    if (rule.status === 301 && target && byFrom.get(target)?.status === 410) issues.push({ kind: 'dead-target', from: rule.from });
    rules.push({ ...rule, to: target });
  }
  return { rules, issues };
};

/** Decoded path of a rule source, or null when the source has a query string (not expressible in path-only servers). */
export const rulePath = (from: string): string | null => {
  const url = new URL(from);
  if (url.search) return null;
  try { return decodeURIComponent(url.pathname); } catch { return url.pathname; }
};
