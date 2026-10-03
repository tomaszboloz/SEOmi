import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { textResult } from './responseOutput.js';
import { LANGUAGE_CODE, READ_ONLY_HINTS } from './serverConstants.js';
import type { createProviderClient } from './providers.js';

export function registerResearchTools(
  server: McpServer,
  dataForSeo: ReturnType<typeof createProviderClient>['dataForSeo'],
): void {
  server.registerTool('seomi_research_keywords', {
    title: 'Research keyword metrics',
    description: 'Fetch live Google Ads keyword volume, CPC, competition, and monthly searches through the configured DataForSEO account.',
    inputSchema: { keyword: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
    annotations: READ_ONLY_HINTS,
  }, async ({ keyword, location_code, language_code }) => {
    try { return textResult(await dataForSeo('/v3/keywords_data/google_ads/search_volume/live', [{ keywords: [keyword], location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_research_keyword_suggestions', {
    title: 'Research keyword suggestions',
    description: 'Fetch live Google Ads keyword ideas and monthly search history for a seed through the configured DataForSEO account.',
    inputSchema: { seed: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
    annotations: READ_ONLY_HINTS,
  }, async ({ seed, location_code, language_code }) => {
    try { return textResult(await dataForSeo('/v3/keywords_data/google_ads/keywords_for_keywords/live', [{ keywords: [seed], location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_research_serp', {
    title: 'Research live Google SERP',
    description: 'Fetch live organic Google SERP entries for a keyword through the configured DataForSEO account.',
    inputSchema: { keyword: z.string().min(1).max(200), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), depth: z.number().int().min(1).max(100).default(20) },
    annotations: READ_ONLY_HINTS,
  }, async ({ keyword, location_code, language_code, depth }) => {
    try { return textResult(await dataForSeo('/v3/serp/google/organic/live/regular', [{ keyword, location_code, language_code, depth }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_track_rank', {
    title: 'Track a domain rank',
    description: 'Fetch a live organic SERP and return the entries matching the requested domain. This is a point-in-time check, not historical rank storage.',
    inputSchema: { keyword: z.string().min(1).max(200), target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), depth: z.number().int().min(1).max(100).default(100) },
    annotations: READ_ONLY_HINTS,
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

  server.registerTool('seomi_research_domain_overview', {
    title: 'Research domain overview',
    description: 'Fetch live organic visibility metrics for a domain through DataForSEO Labs.',
    inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en') },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, location_code, language_code }) => {
    try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/domain_rank_overview/live', [{ target, location_code, language_code }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_research_top_pages', {
    title: 'Research top domain pages',
    description: 'Fetch live top organic pages and keyword counts for a domain through DataForSEO Labs.',
    inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, location_code, language_code, limit }) => {
    try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/relevant_pages/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_research_ranked_keywords', {
    title: 'Research ranked keywords',
    description: 'Fetch live ranked keywords and SERP positions for a domain through DataForSEO Labs.',
    inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, location_code, language_code, limit }) => {
    try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/ranked_keywords/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });

  server.registerTool('seomi_research_domain_competitors', {
    title: 'Research organic competitors',
    description: 'Fetch live organic competitor domains and average positions through DataForSEO Labs.',
    inputSchema: { target: z.string().min(1).max(2048), location_code: z.number().int().positive().default(2840), language_code: z.string().max(35).regex(LANGUAGE_CODE).default('en'), limit: z.number().int().min(1).max(100).default(10) },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, location_code, language_code, limit }) => {
    try { return textResult(await dataForSeo('/v3/dataforseo_labs/google/competitors_domain/live', [{ target, location_code, language_code, limit }])); } catch (error) { return textResult({ error: error instanceof Error ? error.message : String(error) }, true); }
  });
}
