import { BacklinkAnchorDistribution, BacklinkItem, BacklinkProfileData, BacklinkGapOpportunity, DataForSEOBacklinkSummary } from '@/types';
import { prepareBacklinkGapDomains } from '../../../mcp-server/src/contracts/researchDomain.js';
import { DataForSeoPage } from './dataforseoTypes';
import { asRecord, asArray, number, nullableNumber, text, booleanish, localizedDomainOperation } from './dataforseoHelpers';
import { DataForSEOCore } from './dataforseoCore';

const BACKLINK_PAGE_SIZE = 100;

export const getBacklinksSummary = async (client: DataForSEOCore, target: string): Promise<DataForSEOBacklinkSummary | null> => {
  const item = (await client.post('/v3/backlinks/summary/live', [{ target, internal_list_limit: 1000 }]))[0];
  if (!item) return null;
  return {
    target, total_backlinks: number(item.backlinks), referring_domains: number(item.referring_domains),
    referring_main_domains: number(item.referring_main_domains), rank: number(item.rank),
    dofollow_backlinks: item.referring_links_attributes && typeof item.referring_links_attributes === 'object'
      ? Math.max(0, number(item.backlinks) - number(asRecord(item.referring_links_attributes).nofollow))
      : nullableNumber(item.dofollow),
    broken_backlinks: number(item.broken_backlinks),
  };
};

export const getBacklinkAnchorsPage = async (client: DataForSEOCore, target: string, offset = 0, limit = BACKLINK_PAGE_SIZE, totalBacklinks?: number): Promise<DataForSeoPage<BacklinkAnchorDistribution>> => {
  const result = (await client.post('/v3/backlinks/anchors/live', [{ target, limit, offset }]))[0];
  const anchorTotal = totalBacklinks ?? null;
  const items = asArray(result?.items).map(asRecord).map((item): BacklinkAnchorDistribution => ({
    anchor: text(item.anchor), count: number(item.backlinks),
    percentage: anchorTotal !== null && anchorTotal > 0 ? Number(((number(item.backlinks) / anchorTotal) * 100).toFixed(1)) : null,
  }));
  return { items, totalCount: nullableNumber(result?.total_count), referringSubnets: nullableNumber(result?.referring_subnets) };
};

export const getBacklinksPage = async (client: DataForSEOCore, target: string, offset = 0, limit = BACKLINK_PAGE_SIZE): Promise<DataForSeoPage<BacklinkItem>> => {
  const result = (await client.post('/v3/backlinks/backlinks/live', [{ target, limit, offset }]))[0];
  const items = asArray(result?.items).map(asRecord).map((item): BacklinkItem => ({
    source_title: text(item.title), source_url: text(item.url_from), target_url: text(item.url_to), anchor_text: text(item.anchor),
    is_dofollow: booleanish(item.dofollow), domain_rank: number(item.rank), first_seen: text(item.first_seen),
  }));
  return { items, totalCount: nullableNumber(result?.total_count) };
};

export const getBacklinkGapPage = async (client: DataForSEOCore, target: string, competitors: string[], offset = 0, limit = BACKLINK_PAGE_SIZE, includeSubdomains = true): Promise<DataForSeoPage<BacklinkGapOpportunity>> => {
  const { target: normalizedTarget, competitors: normalizedCompetitors } = localizedDomainOperation(() => prepareBacklinkGapDomains(target, competitors));
  const targetsById = Object.fromEntries(normalizedCompetitors.map((domain, index) => [String(index + 1), domain]));
  const safeOffset = Math.max(0, Math.trunc(offset));
  const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit) || BACKLINK_PAGE_SIZE));
  const result = (await client.post('/v3/backlinks/domain_intersection/live', [{
    targets: targetsById, exclude_targets: [normalizedTarget], intersection_mode: 'partial',
    include_subdomains: includeSubdomains, limit: safeLimit, offset: safeOffset,
  }]))[0];
  const rows = asArray(result?.items).map(asRecord);
  const opportunities = rows.flatMap((row): BacklinkGapOpportunity[] => {
    const byTarget = asRecord(row.domain_intersection);
    const competitorData = normalizedCompetitors.flatMap((domain, index) => {
      const data = asRecord(byTarget[String(index + 1)]);
      return number(data.backlinks) > 0 ? [{ domain, referringDomain: text(data.target), backlinks: number(data.backlinks), rank: nullableNumber(data.rank), spamScore: nullableNumber(data.backlinks_spam_score) }] : [];
    });
    const sourceDomain = competitorData.map((item) => item.referringDomain).find(Boolean) || '';
    if (!sourceDomain || competitorData.length === 0) return [];
    return [{
      referring_domain: sourceDomain.toLowerCase().replace(/^www\./, ''), target_backlinks: 0,
      competitor_backlinks: competitorData.map(({ domain, backlinks, rank }) => ({ domain, backlinks, rank })),
      max_competitor_spam_score: competitorData.reduce<number | null>((max, item) => item.spamScore === null ? max : Math.max(max ?? item.spamScore, item.spamScore), null),
    }];
  });
  return { items: opportunities, totalCount: nullableNumber(result?.total_count), rawCount: rows.length };
};

export const getBacklinkProfile = async (client: DataForSEOCore, target: string): Promise<BacklinkProfileData | null> => {
  const summary = await getBacklinksSummary(client, target);
  if (!summary) return null;
  const total = summary.total_backlinks;
  const [anchorsPage, backlinksPage] = await Promise.all([
    getBacklinkAnchorsPage(client, target, 0, BACKLINK_PAGE_SIZE, total),
    getBacklinksPage(client, target),
  ]);
  return {
    domain: target, total_backlinks: summary.total_backlinks, referring_domains: summary.referring_domains,
    referring_subnets: anchorsPage.referringSubnets ?? null, domain_rank: summary.rank,
    dofollow_ratio: total > 0 && summary.dofollow_backlinks !== null ? Number(((summary.dofollow_backlinks / total) * 100).toFixed(1)) : null,
    total_anchor_rows: anchorsPage.totalCount, total_backlink_rows: backlinksPage.totalCount,
    anchors: anchorsPage.items, backlinks: backlinksPage.items,
  };
};
