export interface ListAllReleasesOptions {
  apiUrl?: string;
  repository: string;
  token?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  maxPages?: number;
}

export declare function parseNextLinkHeader(linkHeader: string | null | undefined): string | null;

export declare function isTrustedNextUrl(nextUrl: URL, expectedBase: URL): boolean;

export declare function listAllReleases(options: ListAllReleasesOptions): Promise<any[]>;
