import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { budgetStatus, DATAFORSEO_COST_EVENT, readBudget, readSpend } from '@/services/dataforseo/dataforseoBudget';
import { readAccount } from '@/services/dataforseo/dataforseoAccount';

const snapshot = (projectId: string | null) => {
  if (!projectId) return null;
  const spend = readSpend(projectId);
  const budget = readBudget(projectId);
  return { spend, budget, status: budgetStatus(spend, budget), account: readAccount(projectId) };
};

/** Live month-to-date spend, budget and balance of the active project. */
export const useDataForSeoCost = () => {
  const projectId = useProjectStore((state) => state.activeProjectId);
  const [state, setState] = useState(() => snapshot(projectId));
  useEffect(() => {
    const refresh = () => setState(snapshot(projectId));
    refresh();
    window.addEventListener(DATAFORSEO_COST_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DATAFORSEO_COST_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [projectId]);
  return { projectId, ...(state ?? { spend: null, budget: null, status: null, account: null }) };
};

/** DataForSEO bills in fractions of a cent; show enough digits to be exact. */
export const formatUsd = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: value !== 0 && Math.abs(value) < 1 ? 4 : 2, maximumFractionDigits: 4 }).format(value);
