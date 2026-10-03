import { DomainOverviewData } from '@/types';
import { asRecord, asArray, nullableNumber, text, nullableIntent } from './dataforseoHelpers';
import { getBacklinksSummary } from './dataforseoBacklinks';
import { DataForSEOCore } from './dataforseoCore';

export const getDomainOverview = async (client: DataForSEOCore, target: string, locationCode: number, languageCode = 'en'): Promise<DomainOverviewData | null> => {
  const [overviewResult, rankedResult, pagesResult, competitorsResult, backlinks] = await Promise.all([
    client.post('/v3/dataforseo_labs/google/domain_rank_overview/live', [{ target, location_code: locationCode, language_code: languageCode }]),
    client.post('/v3/dataforseo_labs/google/ranked_keywords/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
    client.post('/v3/dataforseo_labs/google/relevant_pages/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
    client.post('/v3/dataforseo_labs/google/competitors_domain/live', [{ target, location_code: locationCode, language_code: languageCode, limit: 10 }]),
    getBacklinksSummary(client, target),
  ]);
  const overviewItem = asArray(overviewResult[0]?.items).map(asRecord)[0];
  if (!overviewItem) return null;
  const organicMetrics = asRecord(asRecord(overviewItem.metrics).organic);
  const rawOrganicTraffic = nullableNumber(organicMetrics.etv);
  const organicTraffic = rawOrganicTraffic === null ? null : Math.round(rawOrganicTraffic);
  const ranked = asArray(rankedResult[0]?.items).map(asRecord);
  const pages = asArray(pagesResult[0]?.items).map(asRecord);
  const competitors = asArray(competitorsResult[0]?.items).map(asRecord);
  return {
    domain: target, organic_traffic: organicTraffic, organic_keywords: nullableNumber(organicMetrics.count),
    domain_rank: backlinks ? backlinks.rank : null, referring_domains: backlinks ? backlinks.referring_domains : null,
    total_backlinks: backlinks ? backlinks.total_backlinks : null,
    dofollow_ratio: backlinks && backlinks.total_backlinks > 0 && backlinks.dofollow_backlinks !== null
      ? Number(((backlinks.dofollow_backlinks / backlinks.total_backlinks) * 100).toFixed(1)) : null,
    top_keywords: ranked.map((row) => {
      const keywordData = asRecord(row.keyword_data); const serp = asRecord(row.ranked_serp_element); const serpItem = asRecord(serp.serp_item); const keywordInfo = asRecord(keywordData.keyword_info);
      const estimatedTraffic = nullableNumber(serpItem.etv);
      return {
        keyword: text(keywordData.keyword), position: nullableNumber(serpItem.rank_absolute),
        search_volume: nullableNumber(keywordInfo.search_volume),
        traffic_share: estimatedTraffic !== null && rawOrganicTraffic !== null && rawOrganicTraffic > 0 ? Number(((estimatedTraffic / rawOrganicTraffic) * 100).toFixed(2)) : null,
        intent: nullableIntent(asRecord(keywordData.search_intent_info).main_intent),
      };
    }).filter((row) => row.keyword && (row.position === null || row.position <= 100)),
    top_pages: pages.map((row) => {
      const pageOrganic = asRecord(asRecord(row.metrics).organic);
      const pageTraffic = nullableNumber(pageOrganic.etv);
      return { url: text(row.page_address), traffic_percentage: pageTraffic !== null && rawOrganicTraffic !== null && rawOrganicTraffic > 0 ? Number(((pageTraffic / rawOrganicTraffic) * 100).toFixed(2)) : null, keywords_count: nullableNumber(pageOrganic.count) };
    }).filter((page) => page.url),
    competitors: competitors.map((row) => ({ domain: text(row.domain).toLowerCase().replace(/^www\./, ''), common_keywords: nullableNumber(row.intersections), average_position: nullableNumber(row.avg_position) })).filter((row) => row.domain && row.domain !== target.toLowerCase().replace(/^www\./, '')),
  };
};
