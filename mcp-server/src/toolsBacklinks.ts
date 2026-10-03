import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { prepareBacklinkGapDomains } from './contracts/researchDomain.js';
import { textResult } from './responseOutput.js';
import { READ_ONLY_HINTS } from './serverConstants.js';
import type { createProviderClient } from './providers.js';

export function registerBacklinkTools(
  server: McpServer,
  dataForSeo: ReturnType<typeof createProviderClient>['dataForSeo'],
): void {
  server.registerTool('seomi_research_backlinks', {
    title: 'Research backlink summary',
    description: 'Fetch a live backlink and referring-domain summary through the configured DataForSEO account.',
    inputSchema: { target: z.string().min(1).max(2048) },
    annotations: READ_ONLY_HINTS,
  }, async ({ target }) => {
    try {
      return textResult(await dataForSeo('/v3/backlinks/summary/live', [{ target }]));
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
  });

  server.registerTool('seomi_research_backlink_anchors', {
    title: 'Research backlink anchor distribution',
    description: 'Fetch a bounded page of live backlink anchor-text distribution through the configured DataForSEO account.',
    inputSchema: {
      target: z.string().min(1).max(2048),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(1000).default(100),
    },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, offset, limit }) => {
    try {
      return textResult(await dataForSeo('/v3/backlinks/anchors/live', [{ target, offset, limit }]));
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
  });

  server.registerTool('seomi_research_backlink_pages', {
    title: 'Research backlink pages',
    description: 'Fetch a bounded page of live backlinks with source and target URLs through the configured DataForSEO account.',
    inputSchema: {
      target: z.string().min(1).max(2048),
      offset: z.number().int().min(0).max(100000).default(0),
      limit: z.number().int().min(1).max(1000).default(100),
    },
    annotations: READ_ONLY_HINTS,
  }, async ({ target, offset, limit }) => {
    try {
      return textResult(await dataForSeo('/v3/backlinks/backlinks/live', [{ target, offset, limit }]));
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
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
    annotations: READ_ONLY_HINTS,
  }, async ({ target, competitors, include_subdomains, offset, limit }) => {
    try {
      const { target: normalizedTarget, competitors: normalizedCompetitors } = prepareBacklinkGapDomains(target, competitors);
      const targets = Object.fromEntries(normalizedCompetitors.map((domain, index) => [String(index + 1), domain]));
      return textResult(await dataForSeo('/v3/backlinks/domain_intersection/live', [{
        targets,
        exclude_targets: [normalizedTarget],
        intersection_mode: 'partial',
        include_subdomains,
        offset,
        limit,
      }]));
    } catch (error) {
      return textResult({ error: error instanceof Error ? error.message : String(error) }, true);
    }
  });
}
