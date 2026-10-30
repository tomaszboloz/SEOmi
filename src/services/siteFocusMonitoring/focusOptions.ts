import { focusConfigHash } from '@/services/siteFocus/configHash';
import { readAnchorUrls } from './anchors';
import { readBrandPolicy } from './brand';
import { readBusinessGoal } from './goal';
import { readManualTopic, type ManualTopic } from './topic';
import type { BrandPolicyInput } from '@/services/siteFocus/types';

export interface ProjectFocusOptions { manualTopic?: ManualTopic; anchorUrls?: string[]; businessGoal?: string; brand?: BrandPolicyInput }

/**
 * The project's saved Core Topic inputs, so every SFS consumer picks the same topic as the Focus tab.
 * Kept free of monitoring/alert imports: views and services read it without pulling the alert pipeline.
 */
export const projectFocusOptions = (projectId: string | null | undefined): ProjectFocusOptions => {
  const anchorUrls = readAnchorUrls(projectId);
  const businessGoal = readBusinessGoal(projectId);
  const brand = readBrandPolicy(projectId);
  return {
    manualTopic: readManualTopic(projectId), ...(anchorUrls.length ? { anchorUrls } : {}), ...(businessGoal ? { businessGoal } : {}),
    ...(Object.keys(brand).length ? { brand } : {}),
  };
};

/** Revision of the saved Core Topic inputs; dependent TAS/IGOS/EETV views key their memoised reports on it (#82). */
export const focusConfigRevision = (projectId: string | null | undefined): string => focusConfigHash(projectFocusOptions(projectId));
