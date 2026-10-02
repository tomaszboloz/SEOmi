import { dataForSeoLanguage } from '@/services/dataforseo';

/** Keep a rank-tracking draft valid when its provider location changes. */
export const normalizeRankTrackingMarketDraft = (location: string, language: string) => ({
  location,
  language: dataForSeoLanguage(location, language),
});
