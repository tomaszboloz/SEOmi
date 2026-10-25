export interface UploadReleaseAssetOptions {
  uploadUrl?: string;
  apiUrl?: string;
  repository: string;
  releaseId: number | string;
  token: string;
  name: string;
  content: string | Buffer;
  contentType?: string;
  fetchImpl?: typeof fetch;
  existingAssets?: Array<{ id: number; name: string; size?: number }>;
}

export interface FetchOrVerifyAssetOptions {
  asset: { id: number; name: string; size?: number; digest?: string; sha256?: string };
  name: string;
  artifactDir: string;
  realDir: string;
  headers: Record<string, string>;
  apiUrl: string;
  repository: string;
  fetchImpl?: typeof fetch;
}

export declare const PROVENANCE_METADATA_NAMES: ReadonlySet<string>;

export declare function parseAuthoritativeDigest(asset: unknown): string | null;

export declare function extractAssetDigest(asset: unknown): string | null;

export declare function fetchOrVerifyAsset(options: FetchOrVerifyAssetOptions): Promise<{ sha256: string; size: number }>;

export declare function uploadReleaseAsset(options: UploadReleaseAssetOptions): Promise<Record<string, unknown>>;
