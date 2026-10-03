import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { buildWorkspaceHash, parseWorkspaceHash } from '@/services/workspaceDeepLink';

export const useAppRouting = () => {
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projects = useProjectStore(s => s.projects);
  const selectProject = useProjectStore(s => s.selectProject);
  const setActiveTab = useAuditStore(s => s.setActiveTab);
  const activeTab = useAuditStore(s => s.activeTab);
  const handledWorkspaceHash = useRef<string | null>(null);
  const workspaceHashSyncSuppression = useRef<{ hash: string; tab: string } | null>(null);
  const pendingWorkspaceProject = useRef<{ hash: string; projectId: string } | null>(null);
  useEffect(() => {
    const openWorkspaceLink = () => {
      if (window.location.hash.startsWith('#crawl-evidence?')) return;
      if (handledWorkspaceHash.current === window.location.hash) return;
      const link = parseWorkspaceHash(window.location.hash);
      if (!link) {
        handledWorkspaceHash.current = window.location.hash;
        // A malformed or obsolete workspace hash must never remain visible
        // as a dead route. Once the active project is known, normalize it to
        // the safe overview destination and keep the rendered SPA state in
        // sync with the normalized URL. This also prevents a stale lazy
        // workflow from remaining visible after an invalid deep-link.
        if (activeProjectId) {
          setActiveTab('overview');
          const fallbackHash = buildWorkspaceHash({ projectId: activeProjectId, tab: 'overview' });
          if (fallbackHash && window.location.hash !== fallbackHash) {
            handledWorkspaceHash.current = fallbackHash;
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${window.location.search}${fallbackHash}`,
            );
          }
        }
        return;
      }
      // The project store may hydrate asynchronously. Keep the hash pending
      // until its project exists instead of permanently discarding a valid
      // deep-link during the first render.
      if (!projects.some((project) => project.id === link.projectId)) return;
      if (activeProjectId !== link.projectId) {
        pendingWorkspaceProject.current = { hash: window.location.hash, projectId: link.projectId };
        selectProject(link.projectId);
        return;
      }
      handledWorkspaceHash.current = window.location.hash;
      pendingWorkspaceProject.current = null;
      workspaceHashSyncSuppression.current = { hash: window.location.hash, tab: link.tab };
      setActiveTab(link.tab);
    };
    openWorkspaceLink();
    window.addEventListener('hashchange', openWorkspaceLink);
    return () => window.removeEventListener('hashchange', openWorkspaceLink);
  }, [activeProjectId, projects, selectProject, setActiveTab]);
  useEffect(() => {
    if (!activeProjectId || window.location.hash.startsWith('#crawl-evidence?')) return;
    const currentHash = window.location.hash;
    const currentLink = parseWorkspaceHash(currentHash);
    // A deep-link can target another valid project. Keep it intact while the
    // project store catches up; otherwise the stale render would overwrite
    // the link and bounce between projects before the target tab is applied.
    const pendingProject = pendingWorkspaceProject.current;
    if (
      currentLink
      && pendingProject?.hash === currentHash
      && pendingProject.projectId === currentLink.projectId
      && currentLink.projectId !== activeProjectId
      && projects.some((project) => project.id === currentLink.projectId)
    ) {
      return;
    }
    const suppression = workspaceHashSyncSuppression.current;
    if (suppression && suppression.hash === currentHash) {
      if (suppression.tab !== activeTab) return;
      workspaceHashSyncSuppression.current = null;
    }
    const nextHash = buildWorkspaceHash({ projectId: activeProjectId, tab: activeTab });
    if (!nextHash || currentHash === nextHash) return;
    // replaceState does not emit hashchange. This address describes state we
    // already applied, so a later project switch must not replay it as a link.
    handledWorkspaceHash.current = nextHash;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }, [activeProjectId, activeTab, projects]);
};
