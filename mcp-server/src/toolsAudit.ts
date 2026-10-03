import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MAX_AUDIT_URL_LENGTH } from './httpSafety.js';
import type { auditPublicUrl, crawlPublicSite } from './auditWorkflow.js';
import { textResult, type JsonObject } from './responseOutput.js';
import { READ_ONLY_HINTS } from './serverConstants.js';

type Json = JsonObject;

export function registerAuditTools(
  server: McpServer,
  audit: typeof auditPublicUrl,
  crawl: typeof crawlPublicSite,
): void {
  server.registerTool('seomi_audit_url', {
    title: 'Audit a public URL',
    description: 'Fetch and audit one public URL. Returns HTTP status, redirects, metadata, Open Graph tags, headings, and security headers. Private network targets are blocked.',
    inputSchema: {
      url: z.string().url().max(MAX_AUDIT_URL_LENGTH),
      timeout_ms: z.number().int().min(1000).max(30000).default(15000),
      scope_host: z.string().trim().min(1).max(255).optional(),
      allow_subdomains: z.boolean().default(false),
      scope_path: z.string().trim().max(2048).optional(),
      include_patterns: z.array(z.string().max(200)).max(20).default([]),
      exclude_patterns: z.array(z.string().max(200)).max(20).default([]),
    },
    annotations: READ_ONLY_HINTS,
  }, async ({ url, timeout_ms, scope_host, allow_subdomains, scope_path, include_patterns, exclude_patterns }) => {
    try {
      return textResult(await audit(url, timeout_ms, {
        scopeHost: scope_host,
        allowSubdomains: allow_subdomains,
        scopePath: scope_path,
        includePatterns: include_patterns,
        excludePatterns: exclude_patterns,
      }) as unknown as Json);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
  });

  server.registerTool('seomi_crawl_site', {
    title: 'Crawl a public site',
    description: 'Crawl a bounded public site and audit discovered pages within an exact host or explicitly allowed subdomains. Each URL is revalidated against SSRF and scope rules; limits and per-URL errors are returned explicitly.',
    inputSchema: {
      start_url: z.string().url().max(MAX_AUDIT_URL_LENGTH),
      max_pages: z.number().int().min(1).max(100).default(25),
      max_depth: z.number().int().min(0).max(10).default(3),
      timeout_ms: z.number().int().min(1000).max(30000).default(15000),
      scope_host: z.string().trim().min(1).max(255).optional(),
      allow_subdomains: z.boolean().default(false),
      scope_path: z.string().trim().max(2048).optional(),
      include_patterns: z.array(z.string().max(200)).max(20).default([]),
      exclude_patterns: z.array(z.string().max(200)).max(20).default([]),
    },
    annotations: READ_ONLY_HINTS,
  }, async ({ start_url, max_pages, max_depth, timeout_ms, scope_host, allow_subdomains, scope_path, include_patterns, exclude_patterns }) => {
    try {
      return textResult(await crawl(start_url, timeout_ms, max_pages, max_depth, {
        scopeHost: scope_host,
        allowSubdomains: allow_subdomains,
        scopePath: scope_path,
        includePatterns: include_patterns,
        excludePatterns: exclude_patterns,
      }) as unknown as Json);
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
  });
}
