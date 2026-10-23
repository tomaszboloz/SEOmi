import { csvRows } from './csv';
import type { ArtifactFile, RedirectRule } from './types';

const pathOf = (url: string): string => { const parsed = new URL(url); return `${parsed.pathname}${parsed.search}`; };

/** WordPress Redirection plugin import: CSV (source,target,regex,code) and JSON export. 410 uses the plugin's error action. */
export const buildWpRedirectionCsv = (rules: RedirectRule[]): ArtifactFile => ({
  name: 'wp-redirection.csv',
  content: csvRows([['source', 'target', 'regex', 'code'], ...rules.map((rule) => [pathOf(rule.from), rule.to ?? '', false, rule.status])]),
});

export const buildWpRedirectionJson = (rules: RedirectRule[]): ArtifactFile => ({
  name: 'wp-redirection.json',
  content: `${JSON.stringify({
    redirects: rules.map((rule) => ({
      url: pathOf(rule.from), match_type: 'url', regex: false, group_id: 1, status: 'enabled', position: 0,
      action_type: rule.status === 410 ? 'error' : 'url', action_code: rule.status,
      action_data: rule.to ? { url: rule.to } : '',
    })),
  }, null, 2)}\n`,
});
