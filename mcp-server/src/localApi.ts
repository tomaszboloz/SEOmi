import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { auditPublicUrl, crawlPublicSite } from './auditWorkflow.js';
import {
  authorized,
  json,
  LocalApiError,
  readBody,
  validateOptions,
} from './localApiHttp.js';
import {
  executeApiPayload,
  type AuditRunner,
  type CrawlRunner,
} from './localApiPayload.js';

export { LOCAL_API_MAX_BODY_BYTES } from './localApiHttp.js';
export const LOCAL_API_HOST = '127.0.0.1';

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

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  token: string,
  audit: AuditRunner,
  crawl: CrawlRunner,
  slots: RequestSlots,
): Promise<void> => {
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
    const result = await executeApiPayload(body, request.url || '', audit, crawl);
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
      try {
        logger({
          level: response.statusCode >= 500 ? 'error' : 'info',
          event: 'request_completed',
          request_id: requestId,
          route,
          method: request.method === 'GET' || request.method === 'POST' ? request.method : 'OTHER',
          status: response.statusCode,
          duration_ms: Math.round(performance.now() - start),
        });
      } catch {
        /* Logging must not interrupt request completion. */
      }
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
