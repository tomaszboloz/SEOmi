import { z } from 'zod';


import { type TopicalNode } from "@/services/topicalMap";
import { type TopicalCalendarFilters } from "@/components/Charts/TopicalCalendar";

import type { SchemaArticleType } from "@/services/schemaGenerator";

import { readJsonStorage } from "@/services/storage";

export type TopicalUrlCandidate = {
  url: string;
  title: string;
  source: "crawl" | "content-link" | "sitemap" | "saved";
};

export const normalizeTopicalCandidateUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

export const inputClass =
  "mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-100 outline-none focus:border-emerald-400";

export const labelClass = "block text-[11px] font-medium text-slate-400";

export const topicalNodeDepth = (node: TopicalNode, nodes: TopicalNode[]): number => {
  let depth = 0;
  let parentId = node.parentId;
  const visited = new Set([node.id]);
  while (parentId && depth < nodes.length) {
    if (visited.has(parentId)) break;
    visited.add(parentId);
    const parent = nodes.find((candidate) => candidate.id === parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return depth;
};

export type TopicalWorkspaceView =
  "topics" | "calendar" | "audit" | "schema" | "links" | "entity";

export interface TopicalWorkspacePreferences {
  view: TopicalWorkspaceView;
  month: string;
  filters: TopicalCalendarFilters;
  search: string;
  schemaUrl: string;
  includeSchemaOrganization: boolean;
  includeSchemaBreadcrumbs: boolean;
  schemaArticleType: SchemaArticleType | "";
}

export const defaultTopicalWorkspacePreferences = (): TopicalWorkspacePreferences => {
  const now = new Date();
  return {
    view: "topics",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    filters: { lifecycle: "all", kind: "all", boundary: "all" },
    search: "",
    schemaUrl: "",
    includeSchemaOrganization: true,
    includeSchemaBreadcrumbs: false,
    schemaArticleType: "",
  };
};

export const topicalWorkspacePreferencesKey = (projectId: string) =>
  `seomi_project_${projectId}_topical_workspace_preferences_v1`;

export const readTopicalWorkspacePreferences = (projectId: string | null): TopicalWorkspacePreferences => {
  const defaults = defaultTopicalWorkspacePreferences();
  if (!projectId) return defaults;
  const schema: z.ZodType<TopicalWorkspacePreferences, z.ZodTypeDef, unknown> = z.object({
    view: z.enum(['topics', 'calendar', 'audit', 'schema', 'links', 'entity']).catch('topics'),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).catch(defaults.month),
    filters: z.object({
      lifecycle: z.enum(['all', 'planned', 'briefed', 'drafted', 'published', 'needs-update']).catch('all'),
      kind: z.enum(['all', 'pillar', 'cluster', 'supporting']).catch('all'),
      boundary: z.enum(['all', 'core', 'outer']).catch('all'),
    }).catch(defaults.filters),
    search: z.string().transform(value => value.slice(0, 200)).catch(''),
    schemaUrl: z.string().transform(value => value.slice(0, 2048)).catch(''),
    includeSchemaOrganization: z.boolean().catch(true),
    includeSchemaBreadcrumbs: z.boolean().catch(false),
    schemaArticleType: z.enum(['', 'Article', 'BlogPosting', 'NewsArticle', 'TechArticle']).catch(''),
  });
  const result = schema.safeParse(readJsonStorage<unknown>(topicalWorkspacePreferencesKey(projectId), null));
  return result.success ? result.data : defaults;
};
