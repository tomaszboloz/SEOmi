import React, { useEffect, useRef, useState } from 'react';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore } from '@/stores/projectStore';

export const useAiBrandVisibilitySession = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) =>
    s.projects.find((project) => project.id === s.activeProjectId),
  );
  const aiBrandQuery = useToolsStore((s) => s.aiBrandQuery);
  const aiBrandDomain = useToolsStore((s) => s.aiBrandDomain);
  const aiBrandReport = useToolsStore((s) => s.aiBrandReport);
  const aiBrandHistory = useToolsStore((s) => s.aiBrandHistory);
  const isLoading = useToolsStore((s) => s.isAiBrandLoading);
  const error = useToolsStore((s) => s.aiBrandError);
  const setAiBrandQuery = useToolsStore((s) => s.setAiBrandQuery);
  const setAiBrandDomain = useToolsStore((s) => s.setAiBrandDomain);
  const analyzeAiBrandVisibility = useToolsStore((s) => s.analyzeAiBrandVisibility);
  const selectAiBrandReport = useToolsStore((s) => s.selectAiBrandReport);

  const researchSettings = useToolsStore((s) => s.aiResearchSettings);
  const setResearchSettings = useToolsStore((s) => s.setAiResearchSettings);
  const [prompts, setPrompts] = useState(researchSettings.prompts.join('\n'));
  const [competitors, setCompetitors] = useState(researchSettings.competitors.join('\n'));

  useEffect(() => {
    setPrompts(researchSettings.prompts.join('\n'));
    setCompetitors(researchSettings.competitors.join('\n'));
  }, [activeProjectId, researchSettings]);

  const connectionMethod = useAuthStore((s) => s.connectionMethod);
  const connectionStatus = useAuthStore((s) => s.connectionStatus);
  const connectedProviders = (['openai', 'claude', 'gemini'] as const).filter(
    (item) => connectionMethod[item] === 'local_cli' && connectionStatus[item] === 'connected',
  );
  const initializedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId) return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || aiBrandDomain.trim()) return;
    setAiBrandDomain(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, aiBrandDomain, setAiBrandDomain]);

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiBrandQuery.trim()) return;
    setAiBrandQuery(aiBrandQuery.trim());
    setAiBrandDomain(aiBrandDomain.trim());
    setResearchSettings({
      prompts: prompts.split(/\n/),
      competitors: competitors.split(/\n/),
    });
    analyzeAiBrandVisibility(aiBrandQuery.trim(), aiBrandDomain.trim());
  };

  return {
    aiBrandQuery,
    setAiBrandQuery,
    aiBrandDomain,
    setAiBrandDomain,
    aiBrandReport,
    aiBrandHistory,
    isLoading,
    error,
    selectAiBrandReport,
    researchSettings,
    setResearchSettings,
    prompts,
    setPrompts,
    competitors,
    setCompetitors,
    connectedProviders,
    handleQuery,
  };
};
