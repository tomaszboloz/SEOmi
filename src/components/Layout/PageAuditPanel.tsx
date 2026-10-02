import React from "react";
import type { PageAuditData, TabType } from "@/types";
import { lazyRoute } from "@/services/lazyRoute";

const Overview = lazyRoute(() => import("@/components/Results/Overview").then((module) => ({ default: module.Overview })));
const SocialPreview = lazyRoute(() => import("@/components/Results/SocialPreview").then((module) => ({ default: module.SocialPreview })));
const HeadingsTree = lazyRoute(() => import("@/components/Results/HeadingsTree").then((module) => ({ default: module.HeadingsTree })));
const MetadataTable = lazyRoute(() => import("@/components/Results/MetadataTable").then((module) => ({ default: module.MetadataTable })));
const ImagesAudit = lazyRoute(() => import("@/components/Results/ImagesAudit").then((module) => ({ default: module.ImagesAudit })));
const LinksAudit = lazyRoute(() => import("@/components/Results/LinksAudit").then((module) => ({ default: module.LinksAudit })));
const SecurityHeaders = lazyRoute(() => import("@/components/Results/SecurityHeaders").then((module) => ({ default: module.SecurityHeaders })));
const StructuredDataView = lazyRoute(() => import("@/components/Results/StructuredDataView").then((module) => ({ default: module.StructuredDataView })));
const AmpAuditView = lazyRoute(() => import("@/components/Results/AmpAuditView").then((module) => ({ default: module.AmpAuditView })));
const PerformanceMetrics = lazyRoute(() => import("@/components/Results/PerformanceMetrics").then((module) => ({ default: module.PerformanceMetrics })));
export const DataForSEOAudit = lazyRoute(() => import("@/components/Results/DataForSEOAudit").then((module) => ({ default: module.DataForSEOAudit })));

export const PageAuditPanel: React.FC<{ audit: PageAuditData; activeTab: TabType }> = ({ audit, activeTab }) => (
    <section
      id="audit-panel"
      role="tabpanel"
      aria-labelledby={`audit-tab-${activeTab}`}
      tabIndex={0}
      className="outline-none"
    >
      {activeTab === "overview" && <Overview audit={audit} />}
      {activeTab === "dataforseo" && (
        <DataForSEOAudit audit={audit} />
      )}
      {activeTab === "social" && <SocialPreview audit={audit} />}
      {activeTab === "headings" && (
        <HeadingsTree audit={audit} />
      )}
      {activeTab === "metadata" && (
        <MetadataTable audit={audit} />
      )}
      {activeTab === "images" && <ImagesAudit audit={audit} />}
      {activeTab === "links" && <LinksAudit audit={audit} />}
      {activeTab === "security" && (
        <SecurityHeaders audit={audit} />
      )}
      {activeTab === "structured" && (
        <StructuredDataView audit={audit} />
      )}
      {activeTab === "amp" && <AmpAuditView audit={audit} />}
      {activeTab === "performance" && (
        <PerformanceMetrics audit={audit} />
      )}
    </section>
);
