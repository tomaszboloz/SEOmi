import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import type { SiteFocusReport } from '@/services/siteFocus';
import { ProtectionPanel } from './ProtectionPanel';

/** Adds the GA4 revenue fetch when a Google client ID and the project URL are known. */
export const ConnectedProtectionPanel = ({ report, projectId }: { report: SiteFocusReport; projectId?: string | null }) => {
  const clientId = useToolsStore((state) => state.gscClientId).trim();
  const siteUrl = useProjectStore((state) => state.projects.find((project) => project.id === projectId)?.rootUrl ?? '');
  return <ProtectionPanel report={report} projectId={projectId} ga4={clientId && siteUrl ? { clientId, siteUrl } : undefined} />;
};
