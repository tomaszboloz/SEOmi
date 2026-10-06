export const MAX_SERP_IMPORT_BYTES = 1_048_576;
export const MAX_SERP_IMPORT_RECORDS = 2_000;
export const MAX_SERP_IMPORT_KEYWORDS = 200;
export const MAX_SERP_KEYWORD_LENGTH = 500;
export const MAX_SERP_URL_LENGTH = 2_048;
export const MAX_SERP_RANK = 100;
export const TOP10_MAX_RANK = 10;
export const TOP10_MAX_RESULTS = 10;

export type SerpImportKind = 'csv-import' | 'json-import' | 'bing-rss';
export type SerpAvailability = 'complete' | 'partial' | 'blocked' | 'missing';

export interface SerpSource {
  kind: SerpImportKind;
  provider: string | null;
  sourceUrl: string | null;
  countryCode: string | null;
  locationCode: number | null;
  languageCode: string | null;
  capturedAt: string | null;
  retrievedAt: string | null;
  availability: SerpAvailability;
  reason: string | null;
}

export interface SerpImportRecord {
  keyword: string;
  rank: number;
  url: string;
}

export interface SerpSnapshot {
  keyword: string;
  rows: Array<{ rank: number; url: string }>;
  urls: string[];
  source: SerpSource;
}

export interface SerpImportRejection {
  row: number;
  reason: string;
}

export interface SerpImportResult {
  source: SerpSource;
  records: SerpImportRecord[];
  snapshots: SerpSnapshot[];
  rejected: SerpImportRejection[];
  duplicateCount: number;
  excludedOutsideTop10: number;
}

export interface SerpSourceMetadataInput {
  provider?: unknown;
  sourceUrl?: unknown;
  countryCode?: unknown;
  locationCode?: unknown;
  languageCode?: unknown;
  capturedAt?: unknown;
  retrievedAt?: unknown;
  availability?: unknown;
  reason?: unknown;
}

/** Only explicitly complete evidence may contribute to a full SERP score. */
export const isFullScoreEligible = (source: SerpSource): boolean => source.availability === 'complete';

export const sameSerpContext = (left: SerpSource, right: SerpSource): boolean =>
  left.countryCode !== null && right.countryCode !== null && left.countryCode === right.countryCode &&
  left.locationCode !== null && right.locationCode !== null && left.locationCode === right.locationCode &&
  left.languageCode !== null && right.languageCode !== null && left.languageCode === right.languageCode;
