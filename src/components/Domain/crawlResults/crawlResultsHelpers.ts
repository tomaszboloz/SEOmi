import { z } from 'zod';


import { Activity, Braces, Bot, CircleAlert, FileDown, FileText, Image, Languages, Link2, Map, Radar, Rows3, ScanSearch, Share2, ShieldCheck, FileWarning } from "lucide-react";

import type { CrawlRunRecord, CrawledDiscoverySource, CrawledPageSummary, RenderedPageArtifact, SiteCrawlResult } from "@/types";

import { type CrawlLinkKindFilter, type CrawlLinkSort, type CrawlLinkStatusFilter } from "@/services/crawlLinkFilters";

import { type CrawlResourceProvenanceStatus } from "@/services/crawlResources";

import { readJsonStorage } from "@/services/storage";
import { downloadBlob } from "@/services/download";

export type CrawlTab =
  | "overview"
  | "urls"
  | "crawlerReadiness"
  | "issues"
  | "content"
  | "metadata"
  | "customSearch"
  | "links"
  | "media"
  | "frames"
  | "social"
  | "directives"
  | "international"
  | "structured"
  | "validation"
  | "performance"
  | "visualisations"
  | "exports";

export type CrawlSegment = "all" | "2xx" | "3xx" | "4xx" | "5xx" | "transport";

export type CrawlSort =
  "url" | "status" | "title" | "depth" | "responseTime" | "issues";

export type ResourceProvenanceFilter = "all" | CrawlResourceProvenanceStatus;

export interface CrawlFilterPreset {
  id: string;
  name: string;
  severity: "all" | "Critical" | "Warning" | "Info";
  errorKind: string;
  segment: CrawlSegment;
  onlyProblems: boolean;
  query: string;
  sort: CrawlSort;
  descending: boolean;
}

export type CrawlTabGroup = "core" | "content" | "technical" | "export";

export type MetadataFacet =
  | "all"
  | "missing-title"
  | "empty-title"
  | "title-length"
  | "duplicate-title"
  | "missing-description"
  | "empty-description"
  | "description-length"
  | "duplicate-description";

export const metadataFacetOptions: Array<{
  id: MetadataFacet;
  labelKey: string;
  descriptionKey: string;
}> = [
  { id: "all", labelKey: "all", descriptionKey: "allDescription" },
  {
    id: "missing-title",
    labelKey: "missingTitle",
    descriptionKey: "missingTitleDescription",
  },
  {
    id: "empty-title",
    labelKey: "emptyTitle",
    descriptionKey: "emptyTitleDescription",
  },
  {
    id: "title-length",
    labelKey: "titleLength",
    descriptionKey: "titleLengthDescription",
  },
  {
    id: "duplicate-title",
    labelKey: "duplicateTitle",
    descriptionKey: "duplicateTitleDescription",
  },
  {
    id: "missing-description",
    labelKey: "missingDescription",
    descriptionKey: "missingDescriptionDescription",
  },
  {
    id: "empty-description",
    labelKey: "emptyDescription",
    descriptionKey: "emptyDescriptionDescription",
  },
  {
    id: "description-length",
    labelKey: "descriptionLength",
    descriptionKey: "descriptionLengthDescription",
  },
  {
    id: "duplicate-description",
    labelKey: "duplicateDescription",
    descriptionKey: "duplicateDescriptionDescription",
  },
];

export const metadataFacetIds = new Set<MetadataFacet>(
  metadataFacetOptions.map((facet) => facet.id),
);

export const issueMessageIncludes = (
  page: CrawledPageSummary,
  needle: string,
): boolean =>
  page.issues.some((issue) =>
    issue.message.toLocaleLowerCase().includes(needle),
  );

export const metadataFacetsForPage = (page: CrawledPageSummary): MetadataFacet[] => {
  // Metadata rules apply to HTML documents. Keep PDFs, feeds and other
  // non-HTML responses visible in the URL report without inventing missing
  // title/description findings for them.
  if (
    page.content_type &&
    !page.content_type.toLocaleLowerCase().includes("html")
  ) {
    return [];
  }
  const facets: MetadataFacet[] = [];
  // Native Rust snapshots encode optional strings as JSON null, while older
  // browser snapshots used undefined. Treat both representations identically
  // so a persisted crawl can never crash the metadata report.
  const title = typeof page.title === "string" ? page.title : undefined;
  const metaDescription =
    typeof page.meta_description === "string"
      ? page.meta_description
      : undefined;
  if (title === undefined) facets.push("missing-title");
  else if (title.trim() === "") facets.push("empty-title");
  if (
    title !== undefined &&
    title.trim() !== "" &&
    page.title_length != null &&
    !(page.title_length >= 30 && page.title_length <= 60)
  ) {
    facets.push("title-length");
  } else if (
    title !== undefined &&
    title.trim() !== "" &&
    issueMessageIncludes(page, "title length is")
  ) {
    // Older runs may not persist title_length, but retain the server finding.
    facets.push("title-length");
  }
  if (issueMessageIncludes(page, "duplicate title"))
    facets.push("duplicate-title");

  if (issueMessageIncludes(page, "missing meta description")) {
    facets.push("missing-description");
  } else if (issueMessageIncludes(page, "meta description is empty")) {
    facets.push("empty-description");
  } else if (metaDescription === undefined) {
    // Bounded/older snapshots may not retain the issue list. An absent
    // persisted value is still actionable as missing metadata; current runs
    // distinguish an explicitly empty tag above using the server finding.
    facets.push("missing-description");
  }
  if (
    metaDescription !== undefined &&
    metaDescription.trim() !== "" &&
    page.meta_description_length != null &&
    !(page.meta_description_length >= 70 && page.meta_description_length <= 160)
  ) {
    facets.push("description-length");
  } else if (
    metaDescription !== undefined &&
    metaDescription.trim() !== "" &&
    issueMessageIncludes(page, "meta description length is")
  ) {
    facets.push("description-length");
  }
  if (issueMessageIncludes(page, "duplicate meta description"))
    facets.push("duplicate-description");
  return facets;
};

export interface CrawlResultsTabsProps {
  result: SiteCrawlResult;
  runs: CrawlRunRecord[];
  selectedRun?: CrawlRunRecord;
  onSelectRun: (id: string) => void;
  onDeleteRun?: (id: string) => Promise<void>;
  mapNavigationRequest?: number;
}

export const tabs: Array<{ id: CrawlTab; labelKey: string; icon: typeof Rows3 }> = [
  { id: "overview", labelKey: "tabs.overview", icon: Radar },
  { id: "visualisations", labelKey: "tabs.visualisations", icon: Map },
  { id: "crawlerReadiness", labelKey: "tabs.crawlerReadiness", icon: Bot },
  { id: "urls", labelKey: "tabs.urls", icon: Rows3 },
  { id: "issues", labelKey: "tabs.issues", icon: CircleAlert },
  { id: "content", labelKey: "tabs.content", icon: FileText },
  { id: "metadata", labelKey: "tabs.metadata", icon: FileText },
  { id: "customSearch", labelKey: "customSearch.tab", icon: ScanSearch },
  { id: "links", labelKey: "tabs.links", icon: Link2 },
  { id: "media", labelKey: "tabs.media", icon: Image },
  { id: "frames", labelKey: "tabs.frames", icon: Image },
  { id: "social", labelKey: "tabs.social", icon: Share2 },
  { id: "directives", labelKey: "tabs.directives", icon: ShieldCheck },
  { id: "international", labelKey: "tabs.international", icon: Languages },
  { id: "structured", labelKey: "tabs.structured", icon: Braces },
  { id: "validation", labelKey: "tabs.validation", icon: FileWarning },
  { id: "performance", labelKey: "tabs.performance", icon: Activity },
  { id: "exports", labelKey: "tabs.exports", icon: FileDown },
];

export const tabGroups: Array<{
  id: CrawlTabGroup;
  labelKey: string;
  shortLabelKey: string;
  tabs: CrawlTab[];
}> = [
  {
    id: "core",
    labelKey: "groups.core",
    shortLabelKey: "groups.coreShort",
    tabs: ["overview", "visualisations", "crawlerReadiness", "urls", "issues"],
  },
  {
    id: "content",
    labelKey: "groups.content",
    shortLabelKey: "groups.contentShort",
    tabs: [
      "content",
      "metadata",
      "customSearch",
      "links",
      "media",
      "frames",
      "social",
    ],
  },
  {
    id: "technical",
    labelKey: "groups.technical",
    shortLabelKey: "groups.technicalShort",
    tabs: [
      "directives",
      "international",
      "structured",
      "validation",
      "performance",
    ],
  },
  {
    id: "export",
    labelKey: "groups.export",
    shortLabelKey: "groups.exportShort",
    tabs: ["exports"],
  },
];

export const tabGroupForTab = (tabId: CrawlTab): CrawlTabGroup =>
  tabGroups.find((group) => group.tabs.includes(tabId))?.id || "core";

export interface CrawlNavigationPreferences {
  activeTab: CrawlTab;
  activeTabGroup: CrawlTabGroup;
  metadataFacet: MetadataFacet;
  validationQuery: string;
  validationSeverity: "all" | "Error" | "Warning";
}

export const emptyCrawlNavigationPreferences = (): CrawlNavigationPreferences => ({
  activeTab: "overview",
  activeTabGroup: "core",
  metadataFacet: "all",
  validationQuery: "",
  validationSeverity: "all",
});

export const readCrawlNavigationPreferences = (
  key: string | null,
): CrawlNavigationPreferences => {
  if (!key) return emptyCrawlNavigationPreferences();
  try {
    const parsed: unknown = readJsonStorage(key, null);
    if (!parsed || typeof parsed !== "object")
      return emptyCrawlNavigationPreferences();
    const candidate = parsed as Partial<CrawlNavigationPreferences>;
    const activeTab = tabs.some((tab) => tab.id === candidate.activeTab)
      ? (candidate.activeTab as CrawlTab)
      : "overview";
    return {
      activeTab,
      // Derive the group from the tab so stale entries cannot restore a
      // visually inconsistent group selector after a release changes tabs.
      activeTabGroup: tabGroupForTab(activeTab),
      metadataFacet: metadataFacetIds.has(
        candidate.metadataFacet as MetadataFacet,
      )
        ? (candidate.metadataFacet as MetadataFacet)
        : "all",
      validationQuery:
        typeof candidate.validationQuery === "string"
          ? candidate.validationQuery.slice(0, 120)
          : "",
      validationSeverity:
        candidate.validationSeverity === "Error" ||
        candidate.validationSeverity === "Warning"
          ? candidate.validationSeverity
          : "all",
    };
  } catch {
    return emptyCrawlNavigationPreferences();
  }
};

export interface CrawlLinkNavigationPreferences {
  query: string;
  kind: CrawlLinkKindFilter;
  status: CrawlLinkStatusFilter;
  sort: CrawlLinkSort;
  descending: boolean;
}

export const emptyCrawlLinkNavigationPreferences =
  (): CrawlLinkNavigationPreferences => ({
    query: "",
    kind: "all",
    status: "all",
    sort: "source",
    descending: false,
  });

export const readCrawlLinkNavigationPreferences = (
  key: string | null,
): CrawlLinkNavigationPreferences => {
  if (!key) return emptyCrawlLinkNavigationPreferences();
  const parsed = readJsonStorage(key, null);
  if (!parsed || typeof parsed !== "object")
    return emptyCrawlLinkNavigationPreferences();
  const candidate = parsed as Partial<CrawlLinkNavigationPreferences>;
  return {
    query:
      typeof candidate.query === "string" ? candidate.query.slice(0, 160) : "",
    kind:
      candidate.kind === "internal" || candidate.kind === "external"
        ? candidate.kind
        : "all",
    status: ["unchecked", "ok", "redirect", "error", "blocked"].includes(
      candidate.status || "",
    )
      ? (candidate.status as CrawlLinkStatusFilter)
      : "all",
    sort:
      candidate.sort === "target" ||
      candidate.sort === "anchor" ||
      candidate.sort === "status"
        ? candidate.sort
        : "source",
    descending: candidate.descending === true,
  };
};

export const cell = "px-3 py-2 align-top";

export const tableHead =
  "sticky top-0 bg-slate-950 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500";

export const downloadRenderedArtifact = (artifact: RenderedPageArtifact): void => {
  const binary = atob(artifact.dataBase64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  downloadBlob(artifact.fileName, new Blob([bytes], { type: artifact.contentType }));
};

export const tableWrap =
  "max-h-[min(62vh,680px)] overflow-auto rounded-lg border border-slate-800";

export const formatNumber = (value: number): string =>
  Math.round(value).toLocaleString();

export const normalizeLinkUrl = (value: string): string => {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
};

export const filterPresetsKey = (projectId: string) =>
  `seomi_project_${projectId}_crawl_filter_presets_v1`;

export const loadFilterPresets = (projectId: string): CrawlFilterPreset[] => {
  try {
    const value: unknown = readJsonStorage(
      filterPresetsKey(projectId),
      [],
    );
    const schema = z.object({
      id: z.string().min(1), name: z.string().min(1).max(60),
      severity: z.enum(['all', 'Critical', 'Warning', 'Info']),
      errorKind: z.string().default('all'), segment: z.enum(['all', '2xx', '3xx', '4xx', '5xx', 'transport']),
      onlyProblems: z.boolean(), query: z.string().default(''),
      sort: z.enum(['url', 'status', 'title', 'depth', 'responseTime', 'issues']),
      descending: z.boolean().default(false),
    });
    return Array.isArray(value) ? value.slice(0, 30).flatMap(item => {
      const result = schema.safeParse(item);
      return result.success ? [result.data] : [];
    }) : [];
  } catch {
    return [];
  }
};

export const optional = (value?: string | number | null): string =>
  value === undefined || value === "" ? "—" : String(value);

export const discoverySourcesForPage = (
  page: CrawledPageSummary,
): CrawledDiscoverySource[] => page.discovery_sources || [];
