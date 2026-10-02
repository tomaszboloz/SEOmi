import { useState, useEffect, useMemo } from "react";
import { CrawlSegment, CrawlSort, ResourceProvenanceFilter, CrawlFilterPreset, MetadataFacet, metadataFacetOptions, metadataFacetsForPage, filterPresetsKey, loadFilterPresets } from "../crawlResultsHelpers";
import { crawlErrorKinds, filterCrawlErrors } from "@/services/crawlErrors";
import { buildCrawlResourceInventory } from "@/services/crawlResources";
import { CrawlLinkKindFilter, CrawlLinkSort, CrawlLinkStatusFilter } from "@/services/crawlLinkFilters";
import { writeJsonStorage, readStorage, writeStorage } from "@/services/storage";
import type { SiteCrawlResult, CrawlRunRecord, CrawledPageSummary } from "@/types";

export const useCrawlFilterState = (
  activeProjectId: string | null,
  navigationRunId: string,
  result: SiteCrawlResult,
  _runs: CrawlRunRecord[],
  initialNavigation: any,
  initialLinkNavigation: any
) => {
  const [severity, setSeverity] = useState<"all" | "Critical" | "Warning" | "Info">("all");
  const [errorKind, setErrorKind] = useState("all");
  const [segment, setSegment] = useState<CrawlSegment>("all");
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CrawlSort>("url");
  const [descending, setDescending] = useState(false);
  
  const [validationQuery, setValidationQuery] = useState(initialNavigation.validationQuery);
  const [validationSeverity, setValidationSeverity] = useState<"all" | "Error" | "Warning">(initialNavigation.validationSeverity);
  const [metadataFacet, setMetadataFacet] = useState<MetadataFacet>(initialNavigation.metadataFacet);
  const [resourceProvenanceFilter, setResourceProvenanceFilter] = useState<ResourceProvenanceFilter>("all");
  
  const [filterPresets, setFilterPresets] = useState<CrawlFilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [comparisonRunId, setComparisonRunId] = useState("");
  const [compareByPath, setCompareByPath] = useState(false);
  const [customSearchDisplayLimit, setCustomSearchDisplayLimit] = useState(250);

  const [linkQuery, setLinkQuery] = useState(initialLinkNavigation.query);
  const [linkKind, setLinkKind] = useState<CrawlLinkKindFilter>(initialLinkNavigation.kind);
  const [linkStatus, setLinkStatus] = useState<CrawlLinkStatusFilter>(initialLinkNavigation.status);
  const [linkSort, setLinkSort] = useState<CrawlLinkSort>(initialLinkNavigation.sort);
  const [linkDescending, setLinkDescending] = useState(initialLinkNavigation.descending);
  const [linkEvidence, setLinkEvidence] = useState<{ source: string; target: string } | null>(null);

  useEffect(() => {
    setResourceProvenanceFilter("all");
  }, [navigationRunId]);

  useEffect(() => {
    setSeverity("all"); setErrorKind("all"); setSegment("all"); setOnlyProblems(false);
    setEvidenceUrl(""); setQuery(""); setSort("url"); setDescending(false);
    setComparisonRunId(""); setLinkEvidence(null);
  }, [navigationRunId, result.start_url]);

  useEffect(() => {
    setFilterPresets(activeProjectId ? loadFilterPresets(activeProjectId) : []);
    setSelectedPresetId("");
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) { setCompareByPath(false); return; }
    setCompareByPath(readStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`) === "true");
  }, [activeProjectId]);

  const updateCompareByPath = (value: boolean) => {
    setCompareByPath(value);
    if (activeProjectId) writeStorage(`seomi_project_${activeProjectId}_crawl_compare_path_v1`, String(value));
  };

  const persistFilterPresets = (presets: CrawlFilterPreset[]) => {
    setFilterPresets(presets);
    if (activeProjectId) writeJsonStorage(filterPresetsKey(activeProjectId), presets);
  };

  const saveFilterPreset = () => {
    if (!newPresetName.trim() || !activeProjectId) return;
    const preset: CrawlFilterPreset = {
      id: `preset-${Date.now()}`, name: newPresetName.trim(),
      severity, errorKind, segment, onlyProblems, query, sort, descending
    };
    persistFilterPresets([...filterPresets, preset]);
    setSelectedPresetId(preset.id);
    setNewPresetName("");
  };

  const applyFilterPreset = (id: string) => {
    setSelectedPresetId(id);
    const preset = filterPresets.find(item => item.id === id);
    if (!preset) return;
    setSeverity(preset.severity); setErrorKind(preset.errorKind); setSegment(preset.segment);
    setOnlyProblems(preset.onlyProblems); setQuery(preset.query); setSort(preset.sort); setDescending(preset.descending);
  };

  const errorKinds = crawlErrorKinds([...result.pages, ...(result.resources || [])]);
  const activeErrorKind = errorKinds.includes(errorKind) ? errorKind : "all";

  const pages = useMemo(() => {
    return filterCrawlErrors<CrawledPageSummary>(
      result.pages.filter((page: CrawledPageSummary) => severity === "all" || page.issues.some((issue) => issue.severity === severity)),
      activeErrorKind
    )
      .filter((page: CrawledPageSummary) => {
        const status = page.http_status;
        const inSeg = segment === "all" || (segment === "transport" && Boolean(page.request_error_kind)) ||
          (segment === "2xx" && status !== undefined && status >= 200 && status < 300) ||
          (segment === "3xx" && status !== undefined && status >= 300 && status < 400) ||
          (segment === "4xx" && status !== undefined && status >= 400 && status < 500) ||
          (segment === "5xx" && status !== undefined && status >= 500 && status < 600);
        const needle = query.trim().toLocaleLowerCase();
        const hasProb = page.issues.length > 0 || Boolean(page.request_error_kind) || (status !== undefined && status >= 400);
        return inSeg && (!onlyProblems || hasProb) && (!needle || `${page.url} ${page.title || ""} ${status || ""} ${page.request_error_kind || ""}`.toLocaleLowerCase().includes(needle));
      })
      .sort((a: CrawledPageSummary, b: CrawledPageSummary) => {
        const cmp = sort === "status" ? (a.http_status || 0) - (b.http_status || 0) :
          sort === "depth" ? a.depth - b.depth :
          sort === "responseTime" ? a.response_time_ms - b.response_time_ms :
          sort === "issues" ? a.issues.length - b.issues.length :
          (sort === "title" ? a.title || "" : a.url).localeCompare(sort === "title" ? b.title || "" : b.url, undefined, { sensitivity: "base" });
        return descending ? -cmp : cmp;
      });
  }, [activeErrorKind, descending, onlyProblems, query, result.pages, segment, severity, sort]);

  const resources = filterCrawlErrors(result.resources || [], activeErrorKind);
  const resourceErrorUrls = new Set(resources.map((r: any) => r.url));
  const resourceInventory = useMemo(() => buildCrawlResourceInventory(result), [result]);
  const visibleResourceInventory = resourceInventory.filter(row => resourceErrorUrls.has(row.resource.url) && (resourceProvenanceFilter === "all" || row.status === resourceProvenanceFilter));

  const metadataRows = result.pages.filter((p: CrawledPageSummary) => !p.content_type || p.content_type.toLocaleLowerCase().includes("html")).map((page: CrawledPageSummary) => ({ page, facets: metadataFacetsForPage(page) }));
  const filteredMetadataRows = metadataRows.filter(({ facets }: { facets: MetadataFacet[] }) => metadataFacet === "all" ? true : facets.includes(metadataFacet));
  const metadataFacetCounts = metadataFacetOptions.reduce((counts, facet) => {
    counts[facet.id] = facet.id === "all" ? metadataRows.length : metadataRows.filter(({ facets }: { facets: MetadataFacet[] }) => facets.includes(facet.id)).length;
    return counts;
  }, {} as Record<MetadataFacet, number>);

  return {
    severity, setSeverity, errorKind, setErrorKind, segment, setSegment, onlyProblems, setOnlyProblems,
    evidenceUrl, setEvidenceUrl, query, setQuery, sort, setSort, descending, setDescending,
    validationQuery, setValidationQuery, validationSeverity, setValidationSeverity, metadataFacet, setMetadataFacet,
    resourceProvenanceFilter, setResourceProvenanceFilter, filterPresets, selectedPresetId, setSelectedPresetId,
    newPresetName, setNewPresetName, comparisonRunId, setComparisonRunId, compareByPath, updateCompareByPath,
    customSearchDisplayLimit, setCustomSearchDisplayLimit, linkQuery, setLinkQuery, linkKind, setLinkKind,
    linkStatus, setLinkStatus, linkSort, setLinkSort, linkDescending, setLinkDescending, linkEvidence, setLinkEvidence,
    saveFilterPreset, applyFilterPreset, persistFilterPresets, errorKinds, activeErrorKind, pages,
    resourceInventory, visibleResourceInventory, metadataRows, filteredMetadataRows, metadataFacetCounts
  };
};
