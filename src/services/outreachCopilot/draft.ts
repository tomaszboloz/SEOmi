import type { OutreachTarget } from './gap';

/** The unique source we can offer (IGOS): something the competitors' linked pages do not have. */
export interface UniqueSource { title: string; url: string; summary: string }

export interface DraftTemplate { subject: string; body: string }

export interface OutreachDraft extends DraftTemplate { to: string }

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');

/**
 * Fills a localized template with real data. Placeholders: domain, competitors, site, title, url, summary.
 * Without a unique source there is nothing worth pitching, so no draft is produced. The app never sends it:
 * the user copies or exports the text and sends it from their own mailbox.
 */
export const draftOutreach = (
  target: OutreachTarget,
  site: string,
  source: UniqueSource | null,
  template: DraftTemplate,
): OutreachDraft | null => {
  if (!source || !source.title.trim() || !source.url.trim() || !site.trim()) return null;
  const values = {
    domain: target.domain,
    competitors: target.linkingCompetitors.join(', '),
    site,
    title: source.title.trim(),
    url: source.url.trim(),
    summary: source.summary.trim(),
  };
  return { to: target.domain, subject: fill(template.subject, values), body: fill(template.body, values) };
};
