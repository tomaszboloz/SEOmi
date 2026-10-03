import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MAX_AUDIT_URL_LENGTH } from './httpSafety.js';
import { textResult, type JsonObject } from './responseOutput.js';
import { LANGUAGE_CODE, READ_ONLY_HINTS } from './serverConstants.js';
import type { createProviderClient } from './providers.js';

type Json = JsonObject;

export interface GoogleToolContext {
  googleJson: ReturnType<typeof createProviderClient>['googleJson'];
  googleApiKey: ReturnType<typeof createProviderClient>['googleApiKey'];
  googlePublicJson: ReturnType<typeof createProviderClient>['googlePublicJson'];
  publicTargetUrl: (value: string) => Promise<string>;
}

export function registerGoogleTools(server: McpServer, ctx: GoogleToolContext): void {
  server.registerTool('seomi_pagespeed_insights', {
    title: 'Run PageSpeed Insights',
    description: 'Run a bounded Google Lighthouse/PageSpeed analysis for a public URL and return the provider result without inventing missing metrics.',
    inputSchema: {
      url: z.string().url().max(MAX_AUDIT_URL_LENGTH),
      strategy: z.enum(['mobile', 'desktop']).default('mobile'),
      categories: z.array(z.enum(['performance', 'accessibility', 'best-practices', 'seo'])).min(1).max(4).default(['performance', 'accessibility', 'best-practices', 'seo']),
    },
    annotations: READ_ONLY_HINTS,
  }, async ({ url, strategy, categories }) => {
    try {
      const targetUrl = await ctx.publicTargetUrl(url);
      const key = ctx.googleApiKey();
      const query = new URLSearchParams({ url: targetUrl, strategy, key });
      categories.forEach((category) => query.append('category', category));
      const data = await ctx.googlePublicJson(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${query.toString()}`);
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
    annotations: READ_ONLY_HINTS,
  }, async ({ url, form_factor }) => {
    try {
      const targetUrl = await ctx.publicTargetUrl(url);
      const key = ctx.googleApiKey();
      const data = await ctx.googlePublicJson(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(key)}`, {
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
    annotations: READ_ONLY_HINTS,
  }, async ({ site_url, start_date, end_date, dimensions, type, row_limit, start_row }) => {
    try {
      const encodedSite = encodeURIComponent(site_url);
      const data = await ctx.googleJson(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`, {
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
    annotations: READ_ONLY_HINTS,
  }, async ({ inspection_url, site_url, language_code }) => {
    try {
      const data = await ctx.googleJson('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        body: JSON.stringify({ inspectionUrl: inspection_url, siteUrl: site_url, languageCode: language_code }),
      });
      return textResult({ inspection_url, site_url, data });
    } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });
}
