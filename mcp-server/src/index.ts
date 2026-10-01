#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { MAX_AUDIT_URL_LENGTH, validatePublicTarget } from './httpSafety.js';
import { auditPublicUrl, crawlPublicSite } from './auditWorkflow.js';
import { textResult, type JsonObject } from './responseOutput.js';
import { createProviderClient } from './providers.js';

type Json = JsonObject;

// DataForSEO accepts ISO-639 language codes as well as locale-qualified
// BCP-47 values (for example `zh-CN` and `zh-TW`). Search Console's URL
// Inspection API likewise uses locale-qualified values such as `en-US`.
// Keep validation strict enough to reject malformed input while allowing the
// full language/script/region extension shape supported by both APIs.
const LANGUAGE_CODE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

const { dataForSeo, googleJson, googleApiKey, googlePublicJson } = createProviderClient();

const publicTargetUrl = async (value: string): Promise<string> => {
  const target = await validatePublicTarget(value);
  return target.url.toString();
};

const server = new McpServer({ name: 'seomi-mcp-server', version: '1.0.0' });
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };

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
  annotations: readOnly,
}, async ({ url, timeout_ms, scope_host, allow_subdomains, scope_path, include_patterns, exclude_patterns }) => {
  try {
    return textResult(await auditPublicUrl(url, timeout_ms, {
      scopeHost: scope_host,
      allowSubdomains: allow_subdomains,
      scopePath: scope_path,
      includePatterns: include_patterns,
      excludePatterns: exclude_patterns,
    }) as unknown as Json);
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
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
  annotations: readOnly,
}, async ({ start_url, max_pages, max_depth, timeout_ms, scope_host, allow_subdomains, scope_path, include_patterns, exclude_patterns }) => {
  try {
    return textResult(await crawlPublicSite(start_url, timeout_ms, max_pages, max_depth, {
      scopeHost: scope_host,
      allowSubdomains: allow_subdomains,
      scopePath: scope_path,
      includePatterns: include_patterns,
      excludePatterns: exclude_patterns,
    }) as unknown as Json);
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_keywords', {
  title: 'Research keyword metrics',
  description: 'Fetch live Google Ads keyword volume, CPC, competition, and monthly searches through the configured DataForSEO account.',
  inputSchema: { keyword: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
  annotations: readOnly,
}, async ({ keyword, location_code, language_code }) => {
  try { return textResult(await dataForSeo('/v3/keywords_data/google_ads/search_volume/live', [{ keywords: [keyword], location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_keyword_suggestions', {
  title: 'Research keyword suggestions',
  description: 'Fetch live Google Ads keyword ideas and monthly search history for a seed through the configured DataForSEO account.',
  inputSchema: { seed: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
  annotations: readOnly,
}, async ({ seed, location_code, language_code }) => {
  try { return textResult(await dataForSeo('/v3/keywords_data/google_ads/keywords_for_keywords/live', [{ keywords: [seed], location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_serp', {
  title: 'Research live Google SERP',
  description: 'Fetch live organic Google SERP entries for a keyword through the configured DataForSEO account.',
  inputSchema: { keyword: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), depth: z.number().int().min(1).max(100).default(20) },
  annotations: readOnly,
}, async ({ keyword, location_code, language_code, depth }) => {
  try { return textResult(await dataForSeo('/v3/serp/google/organic/live/regular', [{ keyword, location_code, language_code, depth }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_track_rank', {
  title: 'Track a domain rank',
  description: 'Fetch a live organic SERP and return the entries matching the requested domain. This is a point-in-time check, not historical rank storage.',
  inputSchema: { keyword: z.string().min(1).max(200), target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), depth: z.number().int().min(1).max(100).default(100) },
  annotations: readOnly,
}, async ({ keyword, target, location_code, language_code, depth }) => {
  try {
    const task = await dataForSeo('/v3/serp/google/organic/live/regular', [{ keyword, location_code, language_code, depth }]);
    const targetHost = (() => {
      try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `https://${target}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return target.toLowerCase().replace(/^www\./, '').split('/')[0]; }
    })();
    const rows = Array.isArray(task.result) ? task.result : [];
    const items = rows.flatMap((row) => {
      if (!row || typeof row !== 'object' || !Array.isArray((row as { items?: unknown }).items)) return [];
      return (row as { items: unknown[] }).items;
    }).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
    const matches = items.filter((item) => {
      const candidate = typeof item.url === 'string' ? item.url : typeof item.domain === 'string' ? item.domain : '';
      try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`).hostname.toLowerCase().replace(/^www\./, '') === targetHost; } catch { return candidate.toLowerCase().replace(/^www\./, '') === targetHost; }
    });
    return textResult({ keyword, target, target_host: targetHost, matches, serp_task: task });
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_pagespeed_insights', {
  title: 'Run PageSpeed Insights',
  description: 'Run a bounded Google Lighthouse/PageSpeed analysis for a public URL and return the provider result without inventing missing metrics.',
  inputSchema: {
    url: z.string().url().max(MAX_AUDIT_URL_LENGTH),
    strategy: z.enum(['mobile', 'desktop']).default('mobile'),
    categories: z.array(z.enum(['performance', 'accessibility', 'best-practices', 'seo'])).min(1).max(4).default(['performance', 'accessibility', 'best-practices', 'seo']),
  },
  annotations: readOnly,
}, async ({ url, strategy, categories }) => {
  try {
    const targetUrl = await publicTargetUrl(url);
    const key = googleApiKey();
    const query = new URLSearchParams({ url: targetUrl, strategy, key });
    categories.forEach((category) => query.append('category', category));
    const data = await googlePublicJson(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${query.toString()}`);
    const lighthouse = data.lighthouseResult;
    const bounded = lighthouse && typeof lighthouse === 'object'
      ? {
        requested_url: targetUrl,
        strategy,
        lighthouse_version: (lighthouse as Json).lighthouseVersion ?? null,
        fetch_time: (lighthouse as Json).fetchTime ?? null,
        categories: (lighthouse as Json).categories ?? null,
        audits: Object.fromEntries(Object.entries(((lighthouse as Json).audits || {}) as Json)
          .filter(([id]) => /^(largest-contentful-paint|first-contentful-paint|speed-index|total-blocking-time|cumulative-layout-shift|interactive|server-response-time|render-blocking-resources|modern-image-formats|uses-optimized-images|tap-targets|viewport|document-title|meta-description|link-text|structured-data)$/.test(id))),
        loading_experience: data.loadingExperience ?? null,
        origin_loading_experience: data.originLoadingExperience ?? null,
      }
      : { requested_url: targetUrl, strategy, lighthouse: null, loading_experience: data.loadingExperience ?? null };
    return textResult(bounded as Json);
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_crux', {
  title: 'Read Chrome UX Report data',
  description: 'Read field Core Web Vitals for a public URL or origin from Chrome UX Report. Missing records remain explicit instead of becoming zeroes.',
  inputSchema: {
    url: z.string().url().max(MAX_AUDIT_URL_LENGTH),
    form_factor: z.enum(['PHONE', 'DESKTOP', 'TABLET']).default('PHONE'),
  },
  annotations: readOnly,
}, async ({ url, form_factor }) => {
  try {
    const targetUrl = await publicTargetUrl(url);
    const key = googleApiKey();
    const data = await googlePublicJson(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: JSON.stringify({ url: targetUrl, formFactor: form_factor }),
    });
    return textResult({ requested_url: targetUrl, form_factor, data });
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_gsc_search_analytics', {
  title: 'Search Console analytics',
  description: 'Fetch first-party Search Console clicks, impressions, CTR, position and selected dimensions using a token supplied to the MCP process.',
  inputSchema: {
    site_url: z.string().min(1).max(2048),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dimensions: z.array(z.enum(['date', 'query', 'page', 'country', 'device', 'searchAppearance'])).max(3).default(['query']),
    type: z.enum(['web', 'image', 'video', 'news']).default('web'),
    row_limit: z.number().int().min(1).max(25000).default(1000),
    start_row: z.number().int().min(0).max(100000).default(0),
  },
  annotations: readOnly,
}, async ({ site_url, start_date, end_date, dimensions, type, row_limit, start_row }) => {
  try {
    const encodedSite = encodeURIComponent(site_url);
    const data = await googleJson(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate: start_date, endDate: end_date, dimensions, type, rowLimit: row_limit, startRow: start_row }),
    });
    return textResult({ site_url, start_date, end_date, dimensions, type, row_limit, start_row, data });
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_gsc_url_inspection', {
  title: 'Search Console URL inspection',
  description: 'Inspect one URL in Google Search Console using a token supplied to the MCP process; the API response is returned without interpretation.',
  inputSchema: { inspection_url: z.string().url().max(2048), site_url: z.string().min(1).max(2048), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en-US') },
  annotations: readOnly,
}, async ({ inspection_url, site_url, language_code }) => {
  try {
    const data = await googleJson('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      body: JSON.stringify({ inspectionUrl: inspection_url, siteUrl: site_url, languageCode: language_code }),
    });
    return textResult({ inspection_url, site_url, data });
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_backlinks', {
  title: 'Research backlink summary',
  description: 'Fetch a live backlink and referring-domain summary through the configured DataForSEO account.',
  inputSchema: { target: z.string().min(1).max(2048) },
  annotations: readOnly,
}, async ({ target }) => {
  try { return textResult(await dataForSeo('/v3/backlinks/summary/live', [{ target }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_backlink_anchors', {
  title: 'Research backlink anchor distribution',
  description: 'Fetch a bounded page of live backlink anchor-text distribution through the configured DataForSEO account.',
  inputSchema: {
    target: z.string().min(1).max(2048),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(1000).default(100),
  },
  annotations: readOnly,
}, async ({ target, offset, limit }) => {
  try { return textResult(await dataForSeo('/v3/backlinks/anchors/live', [{ target, offset, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_backlink_pages', {
  title: 'Research backlink pages',
  description: 'Fetch a bounded page of live backlinks with source and target URLs through the configured DataForSEO account.',
  inputSchema: {
    target: z.string().min(1).max(2048),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(1000).default(100),
  },
  annotations: readOnly,
}, async ({ target, offset, limit }) => {
  try { return textResult(await dataForSeo('/v3/backlinks/backlinks/live', [{ target, offset, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_backlink_gap', {
  title: 'Research backlink gap',
  description: 'Find referring domains linking to one or more competitors but not to the target through a bounded DataForSEO intersection request.',
  inputSchema: {
    target: z.string().min(1).max(2048),
    competitors: z.array(z.string().min(1).max(2048)).min(1).max(19),
    include_subdomains: z.boolean().default(true),
    offset: z.number().int().min(0).max(100000).default(0),
    limit: z.number().int().min(1).max(1000).default(100),
  },
  annotations: readOnly,
}, async ({ target, competitors, include_subdomains, offset, limit }) => {
  try {
    const normalizedTarget = target.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const normalizedCompetitors = [...new Set(competitors.map((value) => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')).filter((value) => value && value !== normalizedTarget))];
    if (!normalizedCompetitors.length) throw new Error('Add at least one competitor domain different from the target.');
    const targets = Object.fromEntries(normalizedCompetitors.map((domain, index) => [String(index + 1), domain]));
    return textResult(await dataForSeo('/v3/backlinks/domain_intersection/live', [{
      targets,
      exclude_targets: [normalizedTarget],
      intersection_mode: 'partial',
      include_subdomains,
      offset,
      limit,
    }]));
  } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_domain_overview', {
  title: 'Research domain overview',
  description: 'Fetch live organic visibility metrics for a domain through DataForSEO Labs.',
  inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
  annotations: readOnly,
}, async ({ target, location_code, language_code }) => {
  try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/domain_rank_overview/live', [{ target, location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_top_pages', {
  title: 'Research top domain pages',
  description: 'Fetch live top organic pages and keyword counts for a domain through DataForSEO Labs.',
  inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
  annotations: readOnly,
}, async ({ target, location_code, language_code, limit }) => {
  try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/relevant_pages/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_ranked_keywords', {
  title: 'Research ranked keywords',
  description: 'Fetch live ranked keywords and SERP positions for a domain through DataForSEO Labs.',
  inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
  annotations: readOnly,
}, async ({ target, location_code, language_code, limit }) => {
  try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/ranked_keywords/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

server.registerTool('seomi_research_domain_competitors', {
  title: 'Research organic competitors',
  description: 'Fetch live organic competitor domains and average positions through DataForSEO Labs.',
  inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
  annotations: readOnly,
}, async ({ target, location_code, language_code, limit }) => {
  try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/competitors_domain/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
});

await server.connect(new StdioServerTransport());
