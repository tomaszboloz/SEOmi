import { useMemo } from 'react';
import { useFocusConfigRevision } from '@/hooks/useFocusConfigRevision';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { projectFocusOptions } from '@/services/siteFocusMonitoring/focusOptions';
import { topicModelOf, type TopicModel } from '@/services/topicModel';
import type { CrawledPageSummary } from '@/types';

/** The shared Core Topic of a crawl (#106): the Site Focus model with the project's focus options; undefined when it cannot be built. */
export const useTopicModel = (projectId: string | null | undefined, pages: CrawledPageSummary[], startUrl: string): TopicModel | undefined => {
  const revision = useFocusConfigRevision(projectId);
  return useMemo(() => {
    if (!pages.length) return undefined;
    try {
      const report = buildSiteFocusReport(pages, startUrl, projectFocusOptions(projectId));
      return report.unavailable || !report.model ? undefined : topicModelOf(report);
    } catch {
      return undefined;
    }
  }, [pages, startUrl, projectId, revision]);
};
