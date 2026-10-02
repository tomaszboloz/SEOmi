import { DataForSeoCatalogRow } from '@/services/dataforseoCatalog';

export type JsonRecord = Record<string, unknown>;

export interface DataForSeoMarket {
  code: string;
  label: string;
  locationCode: number;
  countryIsoCode: string;
  locationType: 'Country' | 'Region';
  availableSources: string;
  languages: Array<{ code: string; label: string }>;
  /** Full provider rows retained for callers that need catalogue metadata. */
  catalogRows: DataForSeoCatalogRow[];
}

export interface DataForSeoPage<T> {
  items: T[];
  totalCount: number | null;
  referringSubnets?: number | null;
  rawCount?: number;
}

export interface DataForSeoTaskMeta {
  endpoint: string;
  taskId: string | null;
  statusCode: number | null;
  statusMessage: string | null;
  cost: number | null;
  timeSeconds: number | null;
  resultCount: number | null;
  requestedAt: string;
  completedAt: string;
}

export interface DataForSeoTaskRecord extends DataForSeoTaskMeta {
  projectId: string;
  ok: boolean;
}

/**
 * A provider/network failure that can be shown without pretending that live
 * data exists. The native transport returns a string error, so the status is
 * also extracted from that message when the request runs inside Tauri.
 */
export class DataForSeoRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number | null = null,
    public readonly retryable = false,
    public readonly quotaExceeded = false,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'DataForSeoRequestError';
  }
}
