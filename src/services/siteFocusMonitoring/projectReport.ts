import type { CrawlRunRecord } from '@/types';
import type { SiteFocusReport } from '@/services/siteFocus';
import { buildRunReport } from './analysis';
import { projectFocusOptions } from './focusOptions';

export { focusConfigRevision, projectFocusOptions, type ProjectFocusOptions } from './focusOptions';

export const buildProjectRunReport = (run: CrawlRunRecord, projectId: string | null | undefined, now?: string): SiteFocusReport => {
  const { manualTopic, anchorUrls, businessGoal, brand } = projectFocusOptions(projectId);
  return buildRunReport(run, manualTopic, now, anchorUrls, businessGoal, brand);
};
