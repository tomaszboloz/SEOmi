import { keywordClusteringResultSchema } from '@/services/contracts/keywordClustering';
import { readJsonRecord } from '@/services/storageContracts';
import { resolveDataForSeoMarket, dataForSeoLanguage } from '@/services/dataforseo';
import { readStorage } from '@/services/storage';
import { useToolsStore } from '@/stores/toolsStore';
import { type ClusteringSession, DEFAULT_SESSION, sessionKey } from './keywordClusteringTypes';

export const loadSession = (projectId: string | null): ClusteringSession => {
  const defaults = {
    ...DEFAULT_SESSION,
    country: useToolsStore.getState().keywordCountry,
    language: useToolsStore.getState().keywordLanguage,
  };
  if (!projectId) return defaults;
  try {
    const saved = readJsonRecord(sessionKey(projectId));
    if (!saved || typeof saved !== 'object') return defaults;
    const parsedResult = keywordClusteringResultSchema.safeParse(saved.result);
    // Keep the input so an obsolete saved market cannot erase the user's list.
    const sharedCountry = readStorage(`seomi_project_${projectId}_dataforseo_market_v1`);
    const market = resolveDataForSeoMarket(
      sharedCountry || (typeof saved.country === 'string' ? saved.country : defaults.country),
    );
    const country = market?.code || '';
    return {
      input: typeof saved.input === 'string' ? saved.input : '',
      country,
      language: market
        ? dataForSeoLanguage(
            market.code,
            sharedCountry ? defaults.language : typeof saved.language === 'string' ? saved.language : defaults.language,
          )
        : '',
      minSharedUrls:
        Number.isInteger(saved.minSharedUrls) && Number(saved.minSharedUrls) > 0 ? Number(saved.minSharedUrls) : 3,
      result: (!sharedCountry || saved.country === sharedCountry) && parsedResult.success ? parsedResult.data : null,
    };
  } catch {
    return defaults;
  }
};
