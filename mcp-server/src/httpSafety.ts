import { lookup } from 'node:dns/promises';
import { request as requestHttp, type RequestOptions as HttpRequestOptions } from 'node:http';
import { request as requestHttps } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { Readable } from 'node:stream';
import { isPublicAddress } from './publicAddress.js';

export { isPublicAddress };
export const MAX_AUDIT_URL_LENGTH = 2048;

export type AddressResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const resolveAll: AddressResolver = (hostname) => lookup(hostname, { all: true, verbatim: true });

export interface ValidatedPublicTarget {
  url: URL;
  address: string;
  family: 4 | 6;
}

export const validatePublicTarget = async (value: string, resolve: AddressResolver = resolveAll): Promise<ValidatedPublicTarget> => {
  if (value.length > MAX_AUDIT_URL_LENGTH) throw new Error(`URL cannot exceed ${MAX_AUDIT_URL_LENGTH} characters.`);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are supported.');
  if (url.username || url.password) throw new Error('URLs with embedded credentials are not allowed.');
  // "localhost." and "printer.local." name the same hosts as without the root dot.
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (hostname === 'localhost' || ['.localhost', '.local', '.internal', '.lan'].some((suffix) => hostname.endsWith(suffix))) {
    throw new Error('Local and private network targets are blocked.');
  }
  if (isIP(hostname) && !isPublicAddress(hostname)) throw new Error('Private, loopback, and special-purpose IP targets are blocked.');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await resolve(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error('Private, loopback, and special-purpose network targets are blocked.');
  }
  const address = addresses[0].address;
  const family = isIP(address);
  if (family !== 4 && family !== 6) throw new Error('Hostname resolution did not return a valid IP address.');
  return { url, address, family };
};

export const validatePublicUrl = async (value: string, resolve: AddressResolver = resolveAll): Promise<URL> => (
  await validatePublicTarget(value, resolve)
).url;

export const requestPinnedPublicTarget = async (target: ValidatedPublicTarget, timeoutMs: number): Promise<Response> => {
  const transport = target.url.protocol === 'https:' ? requestHttps : requestHttp;
  const lookupPinned = ((
    _hostname: string,
    options: { all?: boolean } | undefined,
    callback: (...args: unknown[]) => void,
  ) => {
    const result = { address: target.address, family: target.family };
    if (options?.all) callback(null, [result]);
    else callback(null, result.address, result.family);
  }) as NonNullable<HttpRequestOptions['lookup']>;

  return new Promise((resolve, reject) => {
    const request = transport(target.url, {
      method: 'GET',
      headers: { 'user-agent': 'SEOmi-MCP/1.0 (+local desktop workflow)' },
      signal: AbortSignal.timeout(timeoutMs),
      lookup: lookupPinned as LookupFunction,
    }, (incoming) => {
      const headers = new Headers();
      for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
        headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
      }
      const status = incoming.statusCode ?? 502;
      const body = [204, 205, 304].includes(status)
        ? null
        : Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      resolve(new Response(body, { status, statusText: incoming.statusMessage, headers }));
    });
    request.once('error', reject);
    request.end();
  });
};

export interface LimitedBodyText { text: string; truncated: boolean; bytesRead: number; }

export const readResponseTextLimited = async (response: Response, maxBytes: number): Promise<LimitedBodyText> => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Response byte limit must be a non-negative integer.');
  if (!response.body) return { text: '', truncated: false, bytesRead: 0 };
  if (maxBytes === 0) {
    await response.body.cancel();
    return { text: '', truncated: true, bytesRead: 0 };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytesRead = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - bytesRead;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        bytesRead += Math.max(remaining, 0);
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      bytesRead += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(bytesRead);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), truncated, bytesRead };
};
