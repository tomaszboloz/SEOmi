export interface SyncAppVersionOptions {
  rootDir?: string;
  check?: boolean;
}

export interface SyncAppVersionResult {
  version: string;
  changed: string[];
}

export function syncAppVersion(options?: SyncAppVersionOptions): SyncAppVersionResult;
