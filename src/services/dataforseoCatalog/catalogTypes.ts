/**
 * DataForSEO Google locations/languages supplied by the provider catalogue.
 * The source has one row per location/language pair; the UI groups rows by
 * location code while preserving every available language.
 */
export interface DataForSeoCatalogRow {
  locationCode: number;
  locationCodeParent: number | null;
  locationName: string;
  countryIsoCode: string;
  locationType: 'Country' | 'Region';
  languageName: string;
  languageCode: string;
  availableSources: string;
  /** Provider catalogue counts, retained as metadata and never used as live metrics. */
  keywords: number;
  serps: number;
}

export type CatalogTuple = [number, string, string, 'Country' | 'Region', string, string, string];

export type CatalogMetrics = { locationCodeParent: number | null; keywords: number; serps: number };
