import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { createDomainPreferences } from './domain/preferences';
import { createDomainOverviewActions } from './domain/overview';
import { createDomainComparisonActions } from './domain/comparison';

export const createDomainSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setDomainQuery" | "setDomainCountry" | "setDomainLanguage" | "analyzeDomain" | "setDomainComparisonTargets" | "compareDomains"> => ({
  ...createDomainPreferences(set, get),
  ...createDomainOverviewActions(set, get, services),
  ...createDomainComparisonActions(set, get, services),
});
