import { describe, expect, it } from 'vitest';
import { getBuiltInTools } from '@/components/AgentWorkflows/mcpHub/mcpBuiltInTools';

const expectedTools = [
  ['seomi_gsc_search_analytics', 'site_url, start_date, end_date, dimensions?, type?, row_limit?, start_row?'],
  ['seomi_gsc_url_inspection', 'inspection_url, site_url, language_code?'],
  ['seomi_research_keywords', 'keyword, location_code?, language_code?'],
  ['seomi_research_keyword_suggestions', 'seed, location_code?, language_code?'],
  ['seomi_research_serp', 'keyword, location_code?, language_code?, depth?'],
  ['seomi_track_rank', 'keyword, target, location_code?, language_code?, depth?'],
  ['seomi_research_backlinks', 'target'],
  ['seomi_research_backlink_anchors', 'target, offset?, limit?'],
  ['seomi_research_backlink_pages', 'target, offset?, limit?'],
  ['seomi_research_backlink_gap', 'target, competitors, include_subdomains?, offset?, limit?'],
  ['seomi_research_domain_overview', 'target, location_code?, language_code?'],
  ['seomi_research_top_pages', 'target, location_code?, language_code?, limit?'],
  ['seomi_research_ranked_keywords', 'target, location_code?, language_code?, limit?'],
  ['seomi_research_domain_competitors', 'target, location_code?, language_code?, limit?'],
  ['seomi_audit_url', 'url, timeout_ms?'],
  ['seomi_crawl_site', 'start_url, max_pages?, max_depth?, timeout_ms?, scope_host?, allow_subdomains?'],
  ['seomi_pagespeed_insights', 'url, strategy?, categories?'],
  ['seomi_crux', 'url, form_factor?'],
] as const;

describe('built-in MCP tool contracts', () => {
  it('exposes a stable, unique registry in the documented order', () => {
    const translate = ((key: string) => `translated:${key}`) as never;
    const tools = getBuiltInTools(translate);

    expect(tools).toHaveLength(expectedTools.length);
    expect(tools.map((tool) => tool.id)).toEqual(expectedTools.map(([id]) => id));
    expect(new Set(tools.map((tool) => tool.id)).size).toBe(tools.length);
    expect(tools.map((tool) => tool.name)).toEqual(tools.map((tool) => tool.id));
  });

  it('keeps every input signature, translation key and category icon attached to its tool', () => {
    const translate = ((key: string) => `translated:${key}`) as never;
    const tools = getBuiltInTools(translate);

    tools.forEach((tool, index) => {
      const [id, input] = expectedTools[index];
      expect(tool.id).toBe(id);
      expect(tool.input).toBe(input);
      expect(tool.description).toBe(`translated:mcp.toolDesc_${id}`);
      expect(tool.icon).toBeTruthy();
    });

    expect(tools.slice(0, 2).every((tool) => tool.icon === tools[0].icon)).toBe(true);
    expect(tools.slice(2, 5).every((tool) => tool.icon === tools[2].icon)).toBe(true);
    expect(tools.slice(6, 10).every((tool) => tool.icon === tools[6].icon)).toBe(true);
    expect(tools.slice(10, 14).every((tool) => tool.icon === tools[10].icon)).toBe(true);
    expect(tools[14].icon).toBe(tools[15].icon);
    expect(tools[16].icon).toBe(tools[5].icon);
    expect(tools[17].icon).toBe(tools[5].icon);
  });
});
