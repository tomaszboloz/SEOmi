import React, { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, X } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";
import { RouteErrorBoundary } from "@/components/Layout/RouteErrorBoundary";
import { lazyRoute } from "@/services/lazyRoute";
import { isPageAuditTab } from "@/services/workspaceRoutes";
import { DataForSEOAudit, PageAuditPanel } from "@/components/Layout/PageAuditPanel";

// Keep the shell small on startup. Every workspace destination is an
// independent chunk and is fetched only after the user opens that route.
// This is especially important for the crawler and graph visualizations,
// which are substantially heavier than the initial project gate.
const AuditTabs = lazyRoute(() => import("@/components/Results/AuditTabs").then((module) => ({ default: module.AuditTabs })));
const KeywordResearch = lazyRoute(() => import("@/components/Keywords/KeywordResearch").then((module) => ({ default: module.KeywordResearch })));
const KeywordClustering = lazyRoute(() => import("@/components/Keywords/KeywordClustering").then((module) => ({ default: module.KeywordClustering })));
const PageSpeedWorkspace = lazyRoute(() => import("@/components/Performance/PageSpeedWorkspace").then((module) => ({ default: module.PageSpeedWorkspace })));
const SavedKeywords = lazyRoute(() => import("@/components/Keywords/SavedKeywords").then((module) => ({ default: module.SavedKeywords })));
const RankTracking = lazyRoute(() => import("@/components/Keywords/RankTracking").then((module) => ({ default: module.RankTracking })));
const DomainOverview = lazyRoute(() => import("@/components/Domain/DomainOverview").then((module) => ({ default: module.DomainOverview })));
const BacklinkChecker = lazyRoute(() => import("@/components/Domain/BacklinkChecker").then((module) => ({ default: module.BacklinkChecker })));
const SiteAudit = lazyRoute(() => import("@/components/Domain/SiteAudit").then((module) => ({ default: module.SiteAudit })));
const AiBrandVisibility = lazyRoute(() => import("@/components/AiVisibility/AiBrandVisibility").then((module) => ({ default: module.AiBrandVisibility })));
const AiSearchPrompts = lazyRoute(() => import("@/components/AiVisibility/AiSearchPrompts").then((module) => ({ default: module.AiSearchPrompts })));
const McpHub = lazyRoute(() => import("@/components/AgentWorkflows/McpHub").then((module) => ({ default: module.McpHub })));
const SearchConsoleHub = lazyRoute(() => import("@/components/AgentWorkflows/SearchConsoleHub").then((module) => ({ default: module.SearchConsoleHub })));
const SeoToolsWorkspace = lazyRoute(() => import("@/components/SeoTools/SeoToolsWorkspace").then((module) => ({ default: module.SeoToolsWorkspace })));

export const MainContent: React.FC = () => {
  const { t } = useTranslation();
  const currentAudit = useAuditStore((s) => s.currentAudit);
  const isLoading = useAuditStore((s) => s.isLoading);
  const error = useAuditStore((s) => s.error);
  const activeTab = useAuditStore((s) => s.activeTab);
  const pageAuditRoute = isPageAuditTab(activeTab);

  const loadingView = (
    <div role="status" className="flex min-h-[32vh] items-center justify-center gap-2 px-6 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" aria-hidden="true" />
      <span>{t("mainContent.loadingView")}</span>
    </div>
  );

  return (
    <main className="flex-1 min-h-0 h-full overflow-y-auto bg-slate-950 flex flex-col relative pb-28">
      {/* Live Loading Top Bar */}
      {isLoading && (
        <div className="sticky top-0 z-40 w-full bg-emerald-950/80 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 backdrop-blur-md animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span className="font-medium">
              {t("app.loading")} — {t("mainContent.loadingDetails")}
            </span>
          </div>
          <div className="w-24 h-1.5 bg-emerald-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full animate-[pulse_1s_infinite] w-3/4" />
          </div>
        </div>
      )}

      {/* Error Alert Bar */}
      {error && (
        <div className="sticky top-0 z-40 w-full bg-rose-950/90 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-300 backdrop-blur-md">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => useAuditStore.setState({ error: null })}
            aria-label={t("mainContent.dismissError")}
            className="p-1 hover:bg-rose-900/50 rounded text-rose-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* In-Place SPA Tab Rendering */}
      <RouteErrorBoundary
        key={activeTab}
        title={t("mainContent.routeErrorTitle")}
        description={t("mainContent.routeErrorDescription")}
        retryLabel={t("mainContent.retryRoute")}
        backLabel={t("mainContent.backToOverview")}
        onBack={() => useAuditStore.setState({ activeTab: "overview" })}
      >
        <Suspense fallback={loadingView}>
          <div className="flex-1">
          {/* Page Audit Suite */}
          {currentAudit && (pageAuditRoute || activeTab === "dataforseo") && (
            <AuditTabs />
          )}
          {pageAuditRoute && !currentAudit && (
            <div className="mx-auto flex min-h-[48vh] max-w-lg flex-col justify-center px-8 text-center">
              <h2 className="text-lg font-semibold text-slate-100">
                {t("mainContent.noAuditTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {t("mainContent.noAuditDescription")}
              </p>
            </div>
          )}
          {currentAudit && (pageAuditRoute || activeTab === "dataforseo") && (
            <PageAuditPanel audit={currentAudit} activeTab={activeTab} />
          )}
          {activeTab === "dataforseo" && !currentAudit && (
            <section aria-label={t("dataforseo.title")} className="min-h-full">
              <DataForSEOAudit />
            </section>
          )}

          {/* Keyword Workflows */}
          {activeTab === "keyword-research" && <KeywordResearch />}
          {activeTab === "keyword-clustering" && <KeywordClustering />}
          {activeTab === "core-web-vitals" && <PageSpeedWorkspace />}
          {activeTab === "saved-keywords" && <SavedKeywords />}
          {activeTab === "rank-tracking" && <RankTracking />}

          {/* Domain Research */}
          {activeTab === "domain-overview" && <DomainOverview />}
          {activeTab === "backlink-checker" && <BacklinkChecker />}
          {activeTab === "site-audit" && <SiteAudit />}

          {/* AI Visibility & GEO */}
          {activeTab === "ai-brand-visibility" && <AiBrandVisibility />}
          {activeTab === "ai-search-prompts" && <AiSearchPrompts />}

          {/* AI Agent Workflows */}
          {activeTab === "mcp-hub" && <McpHub />}
          {activeTab === "search-console" && <SearchConsoleHub />}
          {activeTab === "seo-tools" && <SeoToolsWorkspace />}
          </div>
        </Suspense>
      </RouteErrorBoundary>
    </main>
  );
};
