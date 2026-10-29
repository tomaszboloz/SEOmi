# Bounded coverage gap pointer

Root evidence: `coverage100-current-root-gaps.json`, root SHA `f2f7bf64d48f893f1165806bddea5f9a3fed569a`. The 35 paths below have `coverage100SourceMatches: true`; do not duplicate already-covered branches and do not use the two mismatched paths (`src/components/Settings/RenderWorkerPanel.tsx`, `src/services/causalMarket/source.ts`) without a separate source-hash decision.

Each continuation must remain test-only in its assigned prefix, add behavior and error assertions for exact uncovered locations, run bounded targeted tests under `/tmp/seomi-gemini-validation.lock`, and finish with a report plus frozen patch and source hash manifest. A scoped pass is not global 100%.

## Source-matched locations

- `src/components/AgentWorkflows/searchConsole/Tables.tsx`
- `src/components/Charts/SemanticAuditPanel.tsx`
- `src/components/Domain/ScheduledAuditsPanel.tsx`
- `src/components/Domain/crawlResults/CrawlOverviewTab.tsx`
- `src/components/Domain/crawlResults/aio/AioPassageCard.tsx`
- `src/components/Domain/crawlResults/authority/GapBriefPanel.tsx`
- `src/components/Domain/crawlResults/authority/authorityText.ts`
- `src/components/Domain/crawlResults/focus/CrawlFocusTab.tsx`
- `src/components/Domain/crawlResults/linksTab/CrawlLinksExternalCheck.tsx`
- `src/components/Domain/crawlResults/linksTab/CrawlLinksTable.tsx`
- `src/components/Domain/crawlResults/socialTab/CrawlSocialFaviconCell.tsx`
- `src/components/Domain/domainOverview/DomainComparisonTable.tsx`
- `src/components/Help/useHelp.ts`
- `src/components/Help/useHelpTip.ts`
- `src/components/Performance/cruxEvidence.ts`
- `src/components/Results/copilotPatcher/CopilotPatcherPanel.tsx`
- `src/components/Results/dataforseoAudit/DataForSeoSummaryCard.tsx`
- `src/components/Results/metadata/MetadataAccessibilityFindings.tsx`
- `src/components/Results/metadata/MetadataAccessibilityHidden.tsx`
- `src/components/Results/metadata/MetadataDirectives.tsx`
- `src/hooks/useTrust.ts`
- `src/services/internalLinkOpportunities.ts`
- `src/services/auditChecks/httpAndMetaChecks.ts`
- `src/services/dataforseo/dataforseoCore.ts`
- `src/services/eeatTrust/authors.ts`
- `src/services/eeatTrust/build.ts`
- `src/services/eeatTrust/findings.ts`
- `src/services/ga4/join.ts`
- `src/services/indexabilityGate/classify.ts`
- `src/services/multimodal/altCheck.ts`
- `src/services/sija/features.ts`
- `src/services/templateGovernor/informationGain.ts`
- `src/services/topicalAuthorityMonitoring/alerts.ts`
- `src/services/topicalAuthorityReference/benchmark.ts`
- `src/services/topicalDiagnosis/topics.ts`
