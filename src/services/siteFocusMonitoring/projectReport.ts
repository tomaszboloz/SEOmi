import type { CrawlRunRecord } from '@/types';
import type { SiteFocusReport } from '@/services/siteFocus';
import { buildRunReport } from './analysis';
import { readAnchorUrls } from './anchors';
import { readManualTopic, type ManualTopic } from './topic';

export interface ProjectFocusOptions { manualTopic?: ManualTopic; anchorUrls?: string[] }

/** The project's saved Core Topic inputs, so every SFS consumer picks the same topic as the Focus tab. */
export const projectFocusOptions = (projectId: string | null | undefined): ProjectFocusOptions => {
  const anchorUrls = readAnchorUrls(projectId);
  return { manualTopic: readManualTopic(projectId), ...(anchorUrls.length ? { anchorUrls } : {}) };
};

export const buildProjectRunReport = (run: CrawlRunRecord, projectId: string | null | undefined, now?: string): SiteFocusReport => {
  const { manualTopic, anchorUrls } = projectFocusOptions(projectId);
  return buildRunReport(run, manualTopic, now, anchorUrls);
};
