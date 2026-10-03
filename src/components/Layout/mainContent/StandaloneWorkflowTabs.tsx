import {
  KeywordResearch,
  KeywordClustering,
  PageSpeedWorkspace,
  SavedKeywords,
  RankTracking,
  DomainOverview,
  BacklinkChecker,
  SiteAudit,
  AiBrandVisibility,
  AiSearchPrompts,
  McpHub,
  SearchConsoleHub,
  SeoToolsWorkspace,
} from "./mainContentRoutes";

export const StandaloneWorkflowTabs = ({ activeTab }: { activeTab: string }) => (
  <>
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
  </>
);
