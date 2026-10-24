import type { BacklinkItem, BacklinkProfileData, PageAuditData } from '@/types';
import type { SourceAnalysis, SourceEvidence } from '@/services/offPage/sources';

export const sourceLink = (source_url = 'https://source.test/page', domain_rank = 80, is_dofollow = true): BacklinkItem => ({
  source_url, domain_rank, is_dofollow, source_title: '', target_url: 'https://acme.test', anchor_text: '', first_seen: '',
});
export const sourceProfile = (backlinks = [sourceLink()]): BacklinkProfileData => ({
  domain: 'acme.test', backlinks, anchors: [], total_backlinks: 900, referring_domains: 50,
  referring_subnets: null, domain_rank: 40, dofollow_ratio: null, total_anchor_rows: null, total_backlink_rows: null,
});
export const sourceEvidence = (overrides: Partial<SourceEvidence> = {}): SourceEvidence => ({
  sourceUrl: 'https://source.test/page', authority: 80, fetchedAt: null, availability: null, text: '', vector: null, ...overrides,
});
export const sourceAnalysis = (sources = [sourceEvidence()]): SourceAnalysis => ({ sources, topic: null, coreEntity: 'SEO', aliases: ['Acme'] });
export const sourceAudit = (text: string | undefined = 'Acme SEO article', status = 200): PageAuditData => ({
  http_status: status, content_stats: { body_text: text },
}) as PageAuditData;
export const sourceVector = (...values: number[]) => new Float64Array(values);
export const deferredSource = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((resolveValue, rejectValue) => { resolve = resolveValue; reject = rejectValue; });
  return { promise, resolve, reject };
};
