import { readAnchorUrls } from './anchors';
import { readManualTopic, type ManualTopic } from './topic';

export interface ProjectFocusOptions { manualTopic?: ManualTopic; anchorUrls?: string[] }

/**
 * The project's saved Core Topic inputs, so every SFS consumer picks the same topic as the Focus tab.
 * Kept free of monitoring/alert imports: views and services read it without pulling the alert pipeline.
 */
export const projectFocusOptions = (projectId: string | null | undefined): ProjectFocusOptions => {
  const anchorUrls = readAnchorUrls(projectId);
  return { manualTopic: readManualTopic(projectId), ...(anchorUrls.length ? { anchorUrls } : {}) };
};
