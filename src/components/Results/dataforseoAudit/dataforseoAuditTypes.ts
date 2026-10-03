import { PageAuditData } from '@/types';
import { DATAFORSEO_MARKETS } from '@/services/dataforseo';

export interface DataForSEOAuditProps {
  /** Optional: DataForSEO is also a project-level workflow and must remain
   * usable before a page audit exists. */
  audit?: PageAuditData;
}

export const serpInputKey = (projectId: string) => `seomi_project_${projectId}_dataforseo_serp_input_v1`;
export const defaultMarket = (DATAFORSEO_MARKETS.find((market) => market.code === 'US') || DATAFORSEO_MARKETS[0])!;
export const defaultLocationCode = defaultMarket?.locationCode || 2840;
export const defaultLanguageCode = defaultMarket?.languages[0]?.code || 'en';
export const validLocationCodes = new Set(DATAFORSEO_MARKETS.map((market) => market.locationCode));
