import type { Server } from 'node:http';
import type { PublicAuditOptions, PublicAuditResult, PublicCrawlResult } from './auditWorkflow.js';

export const LOCAL_API_HOST = '127.0.0.1';
export const LOCAL_API_MAX_BODY_BYTES = 64 * 1024;

export type AuditRunner = (url: string, timeoutMs: number, options: PublicAuditOptions) => Promise<PublicAuditResult>;
export type CrawlRunner = (url: string, timeoutMs: number, maxPages: number, maxDepth: number, options: PublicAuditOptions) => Promise<PublicCrawlResult>;

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

export class LocalApiError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}

export interface RequestSlots {
  acquire: () => boolean;
  release: () => void;
}

export interface LocalApiHandle {
  host: typeof LOCAL_API_HOST;
  port: number;
  server: Server;
  close: () => Promise<void>;
}
