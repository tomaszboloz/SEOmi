import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { auditPublicUrl, crawlPublicSite, DEFAULT_AUDIT_TIMEOUT_MS, validatePublicScopeOptions, type PublicAuditOptions, type PublicAuditResult, type PublicCrawlResult } from './auditWorkflow.js';

export const LOCAL_API_HOST = '127.0.0.1';
export const LOCAL_API_MAX_BODY_BYTES = 64 * 1024;
const MIN_TOKEN_LENGTH = 16;

type AuditRunner = (url: string, timeoutMs: number, options: PublicAuditOptions) => Promise<PublicAuditResult>;
type CrawlRunner = (url: string, timeoutMs: number, maxPages: number, maxDepth: number, options: PublicAuditOptions) => Promise<PublicCrawlResult>;

export interface LocalApiOptions {
  token: string;
  port?: number;
  audit?: AuditRunner;
  crawl?: CrawlRunner;
  maxConcurrentRequests?: number;
  logger?: (entry: LocalApiLog) => void;
}

export interface LocalApiLog {
  level: 'info' | 'error';
  event: 'request_completed';
  request_id: string;
  route: '/health' | '/v1/audit' | '/v1/crawl' | 'unknown';
  method: string;
  status: number;
  duration_ms: number;
}

class LocalApiError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}

interface RequestSlots {
  acquire: () => boolean;
  release: () => void;
}

export interface LocalApiHandle {
  host: typeof LOCAL_API_HOST;
  port: number;
  server: Server;
  close: () => Promise<void>;
}

const json = (response: ServerResponse, status: number, payload: Record<string, unknown>): void => {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-length', Buffer.byteLength(body));
  response.end(body);
};

const readBody = async (request: IncomingMessage): Promise<unknown> => {
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

const authorized = (request: IncomingMessage, token: string): boolean => {
  const header = request.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  const provided = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(token);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

const validateOptions = (options: LocalApiOptions): void => {
  if (options.token.trim().length < MIN_TOKEN_LENGTH) throw new Error(`Local API token must contain at least ${MIN_TOKEN_LENGTH} characters.`);
  const concurrency = options.maxConcurrentRequests ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Local API concurrency must be an integer between 1 and 16.');
  const port = options.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error('Local API port must be an integer between 0 and 65535.');
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse, token: string, audit: AuditRunner, crawl: CrawlRunner, slots: RequestSlots): Promise<void> => {
  if (!authorized(request, token)) {
    json(response, 401, { error: 'Bearer authentication required.' });
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { ok: true, service: 'seomi-local-api', host: LOCAL_API_HOST });
    return;
  }
  if (request.method !== 'POST' || !['/v1/audit', '/v1/crawl'].includes(request.url || '')) {
    response.setHeader('allow', 'GET, POST');
    json(response, 404, { error: 'Route not found.' });
    return;
  }
  if (!slots.acquire()) {
    response.setHeader('retry-after', '1');
    json(response, 429, { error: 'Local API is busy. Retry shortly.' });
    return;
  }
  try {
    const body = await readBody(request);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LocalApiError('Request body must be a JSON object.', 400);
    const payload = body as Record<string, unknown>;
    const isCrawl = request.url === '/v1/crawl';
    const urlField = isCrawl ? 'start_url' : 'url';
    if (typeof payload[urlField] !== 'string' || (payload[urlField] as string).trim().length === 0) throw new LocalApiError(`Request body requires a non-empty ${urlField}.`, 400);
    const timeoutMs = payload.timeout_ms === undefined ? DEFAULT_AUDIT_TIMEOUT_MS : payload.timeout_ms;
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) throw new LocalApiError('timeout_ms must be an integer between 1000 and 30000.', 400);
    if (payload.scope_host !== undefined && typeof payload.scope_host !== 'string') throw new LocalApiError('scope_host must be a string.', 400);
    if (payload.allow_subdomains !== undefined && typeof payload.allow_subdomains !== 'boolean') throw new LocalApiError('allow_subdomains must be a boolean.', 400);
    if (payload.scope_path !== undefined && typeof payload.scope_path !== 'string') throw new LocalApiError('scope_path must be a string.', 400);
    for (const field of ['include_patterns', 'exclude_patterns']) {
      if (payload[field] !== undefined && (!Array.isArray(payload[field]) || (payload[field] as unknown[]).some((value) => typeof value !== 'string'))) {
        throw new LocalApiError(`${field} must be an array of strings.`, 400);
      }
    }
    const scope: PublicAuditOptions = {
      scopeHost: payload.scope_host as string | undefined,
      allowSubdomains: payload.allow_subdomains as boolean | undefined,
    };
    if (payload.scope_path !== undefined) scope.scopePath = payload.scope_path as string;
    if (payload.include_patterns !== undefined) scope.includePatterns = payload.include_patterns as string[];
    if (payload.exclude_patterns !== undefined) scope.excludePatterns = payload.exclude_patterns as string[];
    try { validatePublicScopeOptions(scope); } catch (error) { throw new LocalApiError(error instanceof Error ? error.message : 'Invalid scope options.', 400); }
    let result: PublicAuditResult | PublicCrawlResult;
    if (isCrawl) {
      const maxPages = payload.max_pages === undefined ? 25 : payload.max_pages;
      const maxDepth = payload.max_depth === undefined ? 3 : payload.max_depth;
      if (typeof maxPages !== 'number' || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new LocalApiError('max_pages must be an integer between 1 and 100.', 400);
      if (typeof maxDepth !== 'number' || !Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 10) throw new LocalApiError('max_depth must be an integer between 0 and 10.', 400);
      result = await crawl(payload[urlField] as string, timeoutMs, maxPages, maxDepth, scope);
    } else {
      result = await audit(payload[urlField] as string, timeoutMs, scope);
    }
    json(response, 200, { ok: true, result });
  } catch (error) {
    const statusCode = error instanceof LocalApiError ? error.statusCode : 422;
    const message = error instanceof LocalApiError ? error.message : 'Local API operation could not be completed. Check the target and try again.';
    json(response, statusCode, { error: message });
  } finally {
    slots.release();
  }

};

export const startLocalApi = async (options: LocalApiOptions): Promise<LocalApiHandle> => {
  validateOptions(options);
  const audit = options.audit || auditPublicUrl;
  const crawl = options.crawl || crawlPublicSite;
  let active = 0;
  const slots: RequestSlots = {
    acquire: () => { if (active >= (options.maxConcurrentRequests ?? 4)) return false; active++; return true; },
    release: () => { active--; },
  };
  const logger = options.logger ?? ((entry: LocalApiLog) => { console.error(JSON.stringify(entry)); });
  const server = createServer({ headersTimeout: 10_000, requestTimeout: 30_000, keepAliveTimeout: 5_000, maxHeaderSize: 16 * 1024 }, (request, response) => {
    const requestId = randomUUID();
    const start = performance.now();
    response.setHeader('x-request-id', requestId);
    response.once('finish', () => {
      const route = request.url === '/health' || request.url === '/v1/audit' || request.url === '/v1/crawl' ? request.url : 'unknown';
      try { logger({ level: response.statusCode >= 500 ? 'error' : 'info', event: 'request_completed', request_id: requestId,
        route, method: request.method === 'GET' || request.method === 'POST' ? request.method : 'OTHER', status: response.statusCode, duration_ms: Math.round(performance.now() - start) }); } catch { /* Logging must not interrupt request completion. */ }
    });
    void handleRequest(request, response, options.token, audit, crawl, slots).catch(() => {
      if (!response.headersSent) json(response, 500, { error: 'Local API request failed.' });
      else response.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(options.port ?? 0, LOCAL_API_HOST);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw new Error('Local API did not expose a TCP port.');
  }
  return {
    host: LOCAL_API_HOST,
    port: address.port,
    server,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};
