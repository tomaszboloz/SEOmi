import { DATAFORSEO_LOCATION_CATALOG } from '@/services/dataforseoCatalog';
import { DataForSEOCore } from './dataforseo/dataforseoCore';
import { getBacklinksSummary, getBacklinkAnchorsPage, getBacklinksPage, getBacklinkGapPage, getBacklinkProfile } from './dataforseo/dataforseoBacklinks';
import { getSerpCompetitors } from './dataforseo/dataforseoSerp';
import { getKeywordIdeas } from './dataforseo/dataforseoKeywords';
import { getDomainOverview } from './dataforseo/dataforseoDomain';
import { BacklinkAnchorDistribution, BacklinkItem, BacklinkProfileData, BacklinkGapOpportunity, DataForSEOBacklinkSummary, DataForSEOSerpItem, DomainOverviewData, KeywordIdea } from '@/types';
import { DataForSeoPage } from './dataforseo/dataforseoTypes';

export * from './dataforseo/dataforseoTypes';
export * from './dataforseo/dataforseoMarkets';
export * from './dataforseo/dataforseoTaskLog';
export * from './dataforseo/dataforseoBudget';
export * from './dataforseo/dataforseoBudgetGuard';
export * from './dataforseo/dataforseoAccount';
export { normalizeDataForSeoDomain } from './dataforseo/dataforseoHelpers';
export { DATAFORSEO_LOCATION_CATALOG };

export class DataForSEOClient extends DataForSEOCore {
  async getBacklinksSummary(target: string): Promise<DataForSEOBacklinkSummary | null> {
    return getBacklinksSummary(this, target);
  }
  
  async getSerpCompetitors(keyword: string, locationCode = 2840, languageCode = 'en', allowPartial = false): Promise<DataForSEOSerpItem[]> {
    return getSerpCompetitors(this, keyword, locationCode, languageCode, allowPartial);
  }
  
  async getKeywordIdeas(keyword: string, locationCode: number, languageCode = 'en'): Promise<KeywordIdea[]> {
    return getKeywordIdeas(this, keyword, locationCode, languageCode);
  }
  
  async getBacklinkAnchorsPage(target: string, offset = 0, limit = 100, totalBacklinks?: number): Promise<DataForSeoPage<BacklinkAnchorDistribution>> {
    return getBacklinkAnchorsPage(this, target, offset, limit, totalBacklinks);
  }
  
  async getBacklinksPage(target: string, offset = 0, limit = 100): Promise<DataForSeoPage<BacklinkItem>> {
    return getBacklinksPage(this, target, offset, limit);
  }
  
  async getBacklinkGapPage(target: string, competitors: string[], offset = 0, limit = 100, includeSubdomains = true): Promise<DataForSeoPage<BacklinkGapOpportunity>> {
    return getBacklinkGapPage(this, target, competitors, offset, limit, includeSubdomains);
  }
  
  async getBacklinkProfile(target: string): Promise<BacklinkProfileData | null> {
    return getBacklinkProfile(this, target);
  }
  
  async getDomainOverview(target: string, locationCode: number, languageCode = 'en'): Promise<DomainOverviewData | null> {
    return getDomainOverview(this, target, locationCode, languageCode);
  }
}
