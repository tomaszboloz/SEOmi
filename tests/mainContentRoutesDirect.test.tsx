import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mockAudit } from './fixtures/auditStoreContracts';
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
} from '@/components/Layout/mainContent/mainContentRoutes';

describe('mainContentRoutes lazy module rendering', () => {
  it('resolves every lazy module and renders its real route component', async () => {
    const elements = [
      ['AuditTabs', <AuditTabs />], ['Overview', <Overview audit={mockAudit} />],
      ['SocialPreview', <SocialPreview audit={mockAudit} />], ['HeadingsTree', <HeadingsTree audit={mockAudit} />],
      ['MetadataTable', <MetadataTable audit={mockAudit} />], ['ImagesAudit', <ImagesAudit audit={mockAudit} />],
      ['LinksAudit', <LinksAudit audit={mockAudit} />], ['SecurityHeaders', <SecurityHeaders audit={mockAudit} />],
      ['StructuredDataView', <StructuredDataView audit={mockAudit} />], ['AmpAuditView', <AmpAuditView audit={mockAudit} />],
      ['PerformanceMetrics', <PerformanceMetrics audit={mockAudit} />], ['DataForSEOAudit', <DataForSEOAudit />],
      ['KeywordResearch', <KeywordResearch />], ['KeywordClustering', <KeywordClustering />],
      ['PageSpeedWorkspace', <PageSpeedWorkspace />], ['SavedKeywords', <SavedKeywords />],
      ['RankTracking', <RankTracking />], ['DomainOverview', <DomainOverview />],
      ['BacklinkChecker', <BacklinkChecker />], ['SiteAudit', <SiteAudit />],
      ['AiBrandVisibility', <AiBrandVisibility />], ['AiSearchPrompts', <AiSearchPrompts />],
      ['McpHub', <McpHub />], ['SearchConsoleHub', <SearchConsoleHub />],
      ['SeoToolsWorkspace', <SeoToolsWorkspace />],
    ] as const;

    expect(elements).toHaveLength(25);
    for (const [name, element] of elements) {
      const view = render(
        <Suspense fallback={<span data-testid={`route-loading-${name}`}>loading</span>}>
          {element}
        </Suspense>,
      );
      await waitFor(() => expect(screen.queryByTestId(`route-loading-${name}`)).toBeNull(), { timeout: 10_000 });
      expect(view.container.textContent?.trim(), name).toBeTruthy();
      view.unmount();
    }
  }, 60_000);
});
