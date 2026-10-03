import { useEffect } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';

export const useCrawlEvidenceRouting = () => {
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projects = useProjectStore(s => s.projects);
  const selectProject = useProjectStore(s => s.selectProject);
  const setActiveTab = useAuditStore(s => s.setActiveTab);
  useEffect(() => {
    const openCrawlEvidence = () => {
      const prefix = '#crawl-evidence?';
      if (!window.location.hash.startsWith(prefix)) return;
      const params = new URLSearchParams(window.location.hash.slice(prefix.length));
      const projectId = params.get('project');
      if (!projectId || !params.get('run') || !params.get('url')) return;
      if (!projects.some((project) => project.id === projectId)) return;
      if (projectId !== activeProjectId) selectProject(projectId);
      setActiveTab('site-audit');
    };
    openCrawlEvidence();
    window.addEventListener('hashchange', openCrawlEvidence);
    return () => window.removeEventListener('hashchange', openCrawlEvidence);
  }, [activeProjectId, projects, selectProject, setActiveTab]);
};
