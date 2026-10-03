import type { PageAuditData } from "@/types";
import {
  AuditTabs,
  Overview,
  SocialPreview,
  HeadingsTree,
  MetadataTable,
  ImagesAudit,
  LinksAudit,
  SecurityHeaders,
  StructuredDataView,
  AmpAuditView,
  PerformanceMetrics,
  DataForSEOAudit,
} from "./mainContentRoutes";

interface PageAuditTabPanelProps {
  currentAudit: PageAuditData | null;
  activeTab: string;
  pageAuditRoute: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}

export const PageAuditTabPanel = ({
  currentAudit,
  activeTab,
  pageAuditRoute,
  t,
}: PageAuditTabPanelProps) => {
  const isPageAuditOrDataForSeo = pageAuditRoute || activeTab === "dataforseo";

  return (
    <>
      {currentAudit && isPageAuditOrDataForSeo && <AuditTabs />}

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

      {currentAudit && isPageAuditOrDataForSeo && (
        <section
          id="audit-panel"
          role="tabpanel"
          aria-labelledby={`audit-tab-${activeTab}`}
          tabIndex={0}
          className="outline-none"
        >
          {activeTab === "overview" && <Overview audit={currentAudit} />}
          {activeTab === "dataforseo" && <DataForSEOAudit audit={currentAudit} />}
          {activeTab === "social" && <SocialPreview audit={currentAudit} />}
          {activeTab === "headings" && <HeadingsTree audit={currentAudit} />}
          {activeTab === "metadata" && <MetadataTable audit={currentAudit} />}
          {activeTab === "images" && <ImagesAudit audit={currentAudit} />}
          {activeTab === "links" && <LinksAudit audit={currentAudit} />}
          {activeTab === "security" && <SecurityHeaders audit={currentAudit} />}
          {activeTab === "structured" && <StructuredDataView audit={currentAudit} />}
          {activeTab === "amp" && <AmpAuditView audit={currentAudit} />}
          {activeTab === "performance" && <PerformanceMetrics audit={currentAudit} />}
        </section>
      )}

      {activeTab === "dataforseo" && !currentAudit && (
        <section aria-label={t("dataforseo.title")} className="min-h-full">
          <DataForSEOAudit />
        </section>
      )}
    </>
  );
};
