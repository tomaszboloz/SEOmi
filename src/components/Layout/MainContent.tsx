import React, { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useAuditStore } from "@/stores/auditStore";
import { RouteErrorBoundary } from "@/components/Layout/RouteErrorBoundary";
import { isPageAuditTab } from "@/services/workspaceRoutes";
import { MainContentStatusBars } from "./mainContent/MainContentStatusBars";
import { PageAuditTabPanel } from "./mainContent/PageAuditTabPanel";
import { StandaloneWorkflowTabs } from "./mainContent/StandaloneWorkflowTabs";

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
      <MainContentStatusBars isLoading={isLoading} error={error} t={t} />

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
            <PageAuditTabPanel
              currentAudit={currentAudit}
              activeTab={activeTab}
              pageAuditRoute={pageAuditRoute}
              t={t}
            />
            <StandaloneWorkflowTabs activeTab={activeTab} />
          </div>
        </Suspense>
      </RouteErrorBoundary>
    </main>
  );
};
