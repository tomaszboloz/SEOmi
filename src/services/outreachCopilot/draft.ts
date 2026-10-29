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
  const provenance = 'provenance' in source && source.provenance && typeof source.provenance === 'object' ? source.provenance as Record<string, unknown> : {};
  const values = {
    domain: target.domain,
    competitors: target.linkingCompetitors.join(', '),
    site,
    title: source.title.trim(),
    url: source.url.trim(),
    summary: source.summary.trim(),
    evidence: 'evidenceUrl' in source && typeof source.evidenceUrl === 'string' ? source.evidenceUrl : '',
    informationGain: 'score' in source && typeof source.score === 'number' ? String(source.score) : '',
    novelEntities: 'novelEntities' in source && Array.isArray(source.novelEntities) ? source.novelEntities.join(', ') : '',
    provider: typeof provenance.provider === 'string' ? provenance.provider : '',
    model: typeof provenance.model === 'string' ? provenance.model : '',
    approximation: typeof provenance.approximation === 'string' ? provenance.approximation : '',
    observedAt: typeof provenance.observedAt === 'string' ? provenance.observedAt : '',
  };
  return { to: target.domain, subject: fill(template.subject, values), body: fill(template.body, values) };
};
