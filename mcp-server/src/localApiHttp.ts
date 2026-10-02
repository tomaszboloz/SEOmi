import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { LOCAL_API_MAX_BODY_BYTES, LocalApiError } from './localApiTypes.js';

export const json = (response: ServerResponse, status: number, payload: Record<string, unknown>): void => {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-length', Buffer.byteLength(body));
  response.end(body);
};

export const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > LOCAL_API_MAX_BODY_BYTES) {
    throw new LocalApiError('Request body exceeds the local API limit.', 413);
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > LOCAL_API_MAX_BODY_BYTES) {
      throw new LocalApiError('Request body exceeds the local API limit.', 413);
    }
    chunks.push(buffer);
  }
  if (bytes === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new LocalApiError('Request body must be valid JSON.', 400);
  }
};

export const authorized = (request: IncomingMessage, token: string): boolean => {
  const header = request.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};
