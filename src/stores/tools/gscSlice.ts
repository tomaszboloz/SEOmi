
import { GscPerformanceData, GscPerformanceFilters, GscSiteProperty } from '@/types';

import { writeJsonStorage, writeStorage } from '@/services/storage';

import i18n from '@/i18n';

import type { ToolsState, ToolsSet, ToolsGet, ToolsServices } from './contracts';
import { activeProjectId } from './storageKeys';
import { beginToolRequest, isLatestToolRequest, errorMessage } from './runtime';

import { gscClientIdKey, gscPropertyKey, gscFiltersKey } from './projectPreferences';

export const createGscSlice = (set: ToolsSet, get: ToolsGet, services: ToolsServices): Pick<ToolsState, "setGscProperty" | "setGscFilters" | "resumeGsc" | "connectGsc" | "disconnectGsc" | "refreshGscData" | "inspectGscUrl"> => ({
setGscProperty: (property) => {
    const projectId = activeProjectId();
    beginToolRequest('gsc-data');
    beginToolRequest('gsc-inspection');
    if (projectId) writeStorage(gscPropertyKey(projectId), property);
    set({ gscProperty: property, gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, gscError: null, isGscLoading: false });
  },
setGscFilters: (filters) => {
    const projectId = activeProjectId();
    beginToolRequest('gsc-data');
    const normalized: GscPerformanceFilters = {
      ...(filters.search_type ? { search_type: filters.search_type } : {}),
      ...(filters.device ? { device: filters.device } : {}),
      ...(filters.country?.trim() ? { country: filters.country.trim().toLowerCase().slice(0, 3) } : {}),
    };
    if (projectId) writeJsonStorage(gscFiltersKey(projectId), normalized);
    set({ gscFilters: normalized, gscData: null, gscDataFetchedAt: null, gscError: null, isGscLoading: false });
  },
resumeGsc: async () => {
    const projectId = activeProjectId();
    const clientId = get().gscClientId.trim();
    if (!projectId || !clientId) return;
    const requestToken = beginToolRequest('gsc-session');
    set({ isGscLoading: true, gscError: null });
    try {
      const properties = await services.invoke<GscSiteProperty[]>('list_search_console_properties', { projectId, clientId });
      const storedProperty = get().gscProperty;
      const selectedProperty = properties.some((item) => item.siteUrl === storedProperty) ? storedProperty : properties[0]?.siteUrl || '';
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      if (selectedProperty) writeStorage(gscPropertyKey(projectId), selectedProperty);
      set({ isGscConnected: true, gscProperties: properties, gscProperty: selectedProperty, isGscLoading: false });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscConnected: false, gscProperties: [], isGscLoading: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscResumeFailed')) });
    } finally {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false });
    }
  },
connectGsc: async (clientId, clientSecret) => {
    const projectId = activeProjectId();
    if (!projectId) return set({ gscError: i18n.t('runtimeErrors.tools.gscProject') });
    const normalizedClientId = clientId.trim();
    if (!normalizedClientId) return set({ gscError: i18n.t('runtimeErrors.tools.gscClientId') });
    const requestToken = beginToolRequest('gsc-session');
    writeStorage(gscClientIdKey(projectId), normalizedClientId);
    const normalizedSecret = clientSecret?.trim() || get().gscClientSecret.trim();
    set({ isGscLoading: true, isGscConnected: false, gscProperties: [], gscData: null, gscDataFetchedAt: null, gscError: null });
    try {
      const connectArgs: Record<string, unknown> = { projectId, clientId: normalizedClientId };
      if (normalizedSecret) connectArgs.clientSecret = normalizedSecret;
      const properties = await services.invoke<GscSiteProperty[]>('connect_search_console', connectArgs);
      const storedProperty = get().gscProperty;
      const selectedProperty = properties.some((item) => item.siteUrl === storedProperty) ? storedProperty : properties[0]?.siteUrl || '';
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      if (selectedProperty) writeStorage(gscPropertyKey(projectId), selectedProperty);
      set({ gscClientId: normalizedClientId, gscClientSecret: normalizedSecret, isGscConnected: true, gscProperties: properties, gscProperty: selectedProperty });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscConnected: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscConnectFailed')) });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false }); }
  },
disconnectGsc: async () => {
    const projectId = activeProjectId();
    if (!projectId) return;
    const requestToken = beginToolRequest('gsc-session');
    set({ isGscLoading: true, gscError: null });
    try {
      const status = await services.invoke<string>('disconnect_search_console', { projectId });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-session', requestToken)) return;
      set({ isGscConnected: false, gscClientSecret: '', gscProperties: [], gscData: null, gscDataFetchedAt: null, gscInspectionResult: null, isGscLoading: false, gscError: status.startsWith(i18n.t('runtimeErrors.tools.providerTokenRemovedPrefix')) ? status : null });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-session', requestToken)) set({ isGscLoading: false, gscError: errorMessage(error, i18n.t('runtimeErrors.tools.gscDisconnectFailed')) });
    }
  },
refreshGscData: async (range, requestedFilters) => {
    const projectId = activeProjectId();
    const { gscClientId, gscProperty } = get();
    const filters = requestedFilters ?? get().gscFilters ?? {};
    if (!projectId || !get().isGscConnected || !gscProperty) {
      set({ gscError: i18n.t('runtimeErrors.tools.gscNeedPropertyData') });
      return;
    }
    const requestToken = beginToolRequest('gsc-data');
    set({ isGscLoading: true, gscError: null });
    try {
      const gscData = await services.invoke<GscPerformanceData>('search_console_performance', { projectId, clientId: gscClientId, siteUrl: gscProperty, startDate: range?.startDate ?? null, endDate: range?.endDate ?? null, filters });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-data', requestToken)) return;
      set({ gscData, gscDataFetchedAt: new Date().toISOString() });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-data', requestToken)) set({ gscError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.gscDataFailed') });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-data', requestToken)) set({ isGscLoading: false }); }
  },
inspectGscUrl: async (url) => {
    const projectId = activeProjectId();
    const { gscClientId, gscProperty, isGscConnected } = get();
    if (!projectId || !isGscConnected || !gscProperty) {
      set({ gscError: i18n.t('runtimeErrors.tools.gscNeedPropertyInspect') });
      return;
    }
    const requestToken = beginToolRequest('gsc-inspection');
    set({ isGscLoading: true, gscError: null, gscInspectionResult: null });
    try {
      const gscInspectionResult = await services.invoke<Record<string, unknown>>('inspect_search_console_url', { projectId, clientId: gscClientId, siteUrl: gscProperty, inspectionUrl: url.trim() });
      if (activeProjectId() !== projectId || !isLatestToolRequest('gsc-inspection', requestToken)) return;
      set({ gscInspectionResult });
    } catch (error) {
      if (activeProjectId() === projectId && isLatestToolRequest('gsc-inspection', requestToken)) set({ gscError: error instanceof Error ? error.message : i18n.t('runtimeErrors.tools.gscInspectFailed') });
    } finally { if (activeProjectId() === projectId && isLatestToolRequest('gsc-inspection', requestToken)) set({ isGscLoading: false }); }
  }
});
