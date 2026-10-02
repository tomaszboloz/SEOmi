import type { DataForSeoCatalogRow } from './dataforseoCatalog/catalogTypes';
import { CATALOG } from './dataforseoCatalog/catalogEntries';
import { CATALOG_METRICS } from './dataforseoCatalog/catalogMetrics';

export type { DataForSeoCatalogRow };

export const DATAFORSEO_LOCATION_CATALOG: DataForSeoCatalogRow[] = CATALOG.map(
  ([locationCode, locationName, countryIsoCode, locationType, languageName, languageCode, availableSources]) => ({
    locationCode,
    ...(CATALOG_METRICS[`${locationCode}:${languageCode}`] || { locationCodeParent: null, keywords: 0, serps: 0 }),
    locationName,
    countryIsoCode,
    locationType,
    languageName,
    languageCode,
    availableSources,
  }),
);
