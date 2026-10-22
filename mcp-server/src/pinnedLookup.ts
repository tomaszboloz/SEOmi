import type { RequestOptions as HttpRequestOptions } from 'node:http';

export interface PinnedAddress { address: string; family: 4 | 6; }

/**
 * DNS lookup that only ever answers with already-verified addresses. With `all: true` (used by
 * Happy Eyeballs / autoSelectFamily) the whole list is returned so a dead AAAA falls back to A.
 */
export const pinnedLookup = (addresses: PinnedAddress[]): NonNullable<HttpRequestOptions['lookup']> => ((
  _hostname: string,
  options: { all?: boolean } | undefined,
  callback: (...args: unknown[]) => void,
) => {
  if (options?.all) callback(null, addresses.map((entry) => ({ ...entry })));
  else callback(null, addresses[0].address, addresses[0].family);
}) as NonNullable<HttpRequestOptions['lookup']>;
