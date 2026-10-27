import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import {
  llmBudgetStatus,
  LLM_ECONOMY_EVENT,
  readLlmBudget,
  readLlmSpend,
  readLlmUsageSummary,
} from '@/services/llmEconomy/llmBudget';
import { isLocalProvider, leavesDevice } from '@/services/llmEconomy/costMeter';

const snapshot = (projectId: string | null) => {
  if (!projectId) return null;
  const spend = readLlmSpend(projectId);
  const budget = readLlmBudget(projectId);
  return {
    spend,
    budget,
    status: llmBudgetStatus(spend, budget),
    summary: readLlmUsageSummary(projectId),
  };
};

/** Live month-to-date LLM spend, savings, cache hits and budget status. */
export const useLlmEconomy = (explicitProjectId?: string | null, providerId = '') => {
  const storeProjectId = useProjectStore((state) => state.activeProjectId);
  const projectId = explicitProjectId !== undefined ? explicitProjectId : storeProjectId;
  const [state, setState] = useState(() => snapshot(projectId));

  useEffect(() => {
    const refresh = () => setState(snapshot(projectId));
    refresh();
    window.addEventListener(LLM_ECONOMY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LLM_ECONOMY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [projectId]);

  return {
    projectId,
    spend: state?.spend ?? null,
    budget: state?.budget ?? null,
    status: state?.status ?? null,
    summary: state?.summary ?? null,
    isLocal: isLocalProvider(providerId),
    leavesDevice: leavesDevice(providerId),
  };
};
