import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useProjectStore } from '@/stores/projectStore';

export const useBacklinkSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) =>
    s.projects.find((project) => project.id === s.activeProjectId),
  );
  const backlinkQuery = useToolsStore((s) => s.backlinkQuery);
  const backlinkProfile = useToolsStore((s) => s.backlinkProfile);
  const backlinkProfileHistory = useToolsStore((s) => s.backlinkProfileHistory);
  const isLoading = useToolsStore((s) => s.isBacklinkLoading);
  const error = useToolsStore((s) => s.backlinkError);
  const setBacklinkQuery = useToolsStore((s) => s.setBacklinkQuery);
  const analyzeBacklinks = useToolsStore((s) => s.analyzeBacklinks);
  const loadMoreBacklinks = useToolsStore((s) => s.loadMoreBacklinks);
  const loadMoreBacklinkAnchors = useToolsStore((s) => s.loadMoreBacklinkAnchors);
  const backlinkGapCompetitors = useToolsStore((s) => s.backlinkGapCompetitors);
  const backlinkGapIncludeSubdomains = useToolsStore((s) => s.backlinkGapIncludeSubdomains);
  const backlinkGapReport = useToolsStore((s) => s.backlinkGapReport);
  const isBacklinkGapLoading = useToolsStore((s) => s.isBacklinkGapLoading);
  const backlinkGapError = useToolsStore((s) => s.backlinkGapError);
  const setBacklinkGapCompetitors = useToolsStore((s) => s.setBacklinkGapCompetitors);
  const setBacklinkGapIncludeSubdomains = useToolsStore((s) => s.setBacklinkGapIncludeSubdomains);
  const analyzeBacklinkGap = useToolsStore((s) => s.analyzeBacklinkGap);
  const loadMoreBacklinkGap = useToolsStore((s) => s.loadMoreBacklinkGap);

  const [inputTarget, setInputTarget] = useState(backlinkQuery);
  const [competitorInput, setCompetitorInput] = useState(backlinkGapCompetitors.join('\n'));
  const initializedProjectRef = useRef<string | null>(null);
  const parsedCompetitors = competitorInput
    .split(/[\n,;]+/)
    .map((domain) => domain.trim())
    .filter(Boolean)
    .slice(0, 19);

  useEffect(() => setCompetitorInput(backlinkGapCompetitors.join('\n')), [backlinkGapCompetitors]);

  useEffect(() => {
    setInputTarget(backlinkQuery);
  }, [activeProjectId, backlinkQuery]);

  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId) return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || backlinkQuery.trim()) return;
    setBacklinkQuery(projectRoot);
    setInputTarget(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, backlinkQuery, setBacklinkQuery]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTarget.trim()) return;
    setBacklinkQuery(inputTarget.trim());
    analyzeBacklinks(inputTarget.trim());
  };

  const handleAnalyzeGap = () => {
    setBacklinkGapCompetitors(parsedCompetitors);
    void analyzeBacklinkGap(inputTarget, parsedCompetitors);
  };

  return {
    t,
    inputTarget,
    setInputTarget,
    competitorInput,
    setCompetitorInput,
    parsedCompetitors,
    backlinkProfile,
    backlinkProfileHistory,
    isLoading,
    error,
    backlinkGapIncludeSubdomains,
    setBacklinkGapIncludeSubdomains,
    backlinkGapReport,
    isBacklinkGapLoading,
    backlinkGapError,
    setBacklinkGapCompetitors,
    handleAnalyze,
    handleAnalyzeGap,
    loadMoreBacklinks,
    loadMoreBacklinkAnchors,
    loadMoreBacklinkGap,
  };
};

export type BacklinkSession = ReturnType<typeof useBacklinkSession>;
