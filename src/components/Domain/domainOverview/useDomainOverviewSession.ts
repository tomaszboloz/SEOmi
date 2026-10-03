import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolsStore } from '@/stores/toolsStore';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';

export const useDomainOverviewSession = () => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) =>
    s.projects.find((project) => project.id === s.activeProjectId),
  );
  const domainQuery = useToolsStore((s) => s.domainQuery);
  const domainCountry = useToolsStore((s) => s.domainCountry);
  const domainLanguage = useToolsStore((s) => s.domainLanguage);
  const domainOverview = useToolsStore((s) => s.domainOverview);
  const isLoading = useToolsStore((s) => s.isDomainLoading);
  const error = useToolsStore((s) => s.domainError);
  const setDomainQuery = useToolsStore((s) => s.setDomainQuery);
  const setDomainCountry = useToolsStore((s) => s.setDomainCountry);
  const setDomainLanguage = useToolsStore((s) => s.setDomainLanguage);
  const analyzeDomain = useToolsStore((s) => s.analyzeDomain);
  const domainComparison = useToolsStore((s) => s.domainComparison);
  const domainComparisonHistory = useToolsStore(
    (s) => s.domainComparisonHistory || [],
  );
  const domainComparisonTargets = useToolsStore(
    (s) => s.domainComparisonTargets,
  );
  const isDomainComparisonLoading = useToolsStore(
    (s) => s.isDomainComparisonLoading,
  );
  const domainComparisonError = useToolsStore((s) => s.domainComparisonError);
  const compareDomains = useToolsStore((s) => s.compareDomains);
  const setDomainComparisonTargets = useToolsStore(
    (s) => s.setDomainComparisonTargets,
  );
  const setBacklinkQuery = useToolsStore((s) => s.setBacklinkQuery);
  const setCrawlUrl = useToolsStore((s) => s.setCrawlUrl);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);

  const [inputDomain, setInputDomain] = useState(domainQuery);
  const [comparisonInput, setComparisonInput] = useState('');
  const initializedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const comparisonTarget = domainOverview?.domain || inputDomain;
    setComparisonInput(
      domainComparisonTargets
        .filter((domain) => domain !== comparisonTarget)
        .join('\n'),
    );
  }, [domainComparisonTargets, domainOverview?.domain, inputDomain]);

  useEffect(() => {
    setInputDomain(domainQuery);
  }, [activeProjectId, domainQuery]);

  useEffect(() => {
    const projectRoot = activeProject?.rootUrl?.trim();
    if (!activeProjectId || initializedProjectRef.current === activeProjectId)
      return;
    initializedProjectRef.current = activeProjectId;
    if (!projectRoot || domainQuery.trim()) return;
    setDomainQuery(projectRoot);
    setInputDomain(projectRoot);
  }, [activeProject?.rootUrl, activeProjectId, domainQuery, setDomainQuery]);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDomain.trim()) return;
    setDomainQuery(inputDomain.trim());
    analyzeDomain(inputDomain.trim(), domainCountry, domainLanguage);
  };

  const handleNavigateBacklinks = () => {
    const target = domainOverview?.domain || inputDomain;
    setBacklinkQuery(target);
    setActiveTab('backlink-checker');
  };

  const handleNavigateSiteAudit = () => {
    const target = domainOverview?.domain || inputDomain;
    setCrawlUrl(`https://${target}`);
    setActiveTab('site-audit');
  };

  const handleCompareDomains = (event: React.FormEvent) => {
    event.preventDefault();
    const competitors = comparisonInput
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    const target = domainOverview?.domain || inputDomain;
    setDomainComparisonTargets([target, ...competitors]);
    void compareDomains([target, ...competitors]);
  };

  return {
    t,
    inputDomain,
    setInputDomain,
    comparisonInput,
    setComparisonInput,
    domainCountry,
    setDomainCountry,
    domainLanguage,
    setDomainLanguage,
    domainOverview,
    isLoading,
    error,
    domainComparison,
    domainComparisonHistory,
    domainComparisonTargets,
    isDomainComparisonLoading,
    domainComparisonError,
    setDomainComparisonTargets,
    handleAnalyze,
    handleNavigateBacklinks,
    handleNavigateSiteAudit,
    handleCompareDomains,
  };
};

export type DomainOverviewSession = ReturnType<typeof useDomainOverviewSession>;
