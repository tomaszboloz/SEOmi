import { createContext, useContext } from 'react';
import { OpenInBriefButton } from '@/components/Charts/OpenInBriefButton';
import type { BriefRecommendationInput } from '@/services/executionCard/briefInput';
import { prepareBriefNavigation } from '@/services/executionCard/openBrief';
import { useProjectStore } from '@/stores/projectStore';

/** Host callback that opens the Brief Workstation (the map tab); provided by the crawl results view. */
export const BriefNavigationContext = createContext<(() => void) | null>(null);

/** Card-level 1-click brief: saves the brief, then navigates to the ContentBrief workstation. */
export const BriefCardButton = ({ input }: { input: BriefRecommendationInput }) => {
  const projectId = useProjectStore((state) => state.activeProjectId);
  const openWorkstation = useContext(BriefNavigationContext);
  if (!projectId) return null;
  return <OpenInBriefButton projectId={projectId} input={input} onOpened={(nodeId) => { prepareBriefNavigation(projectId, nodeId); openWorkstation?.(); }} />;
};
