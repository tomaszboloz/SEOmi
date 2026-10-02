import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceIndicatorsStore } from '@/stores/workspaceIndicatorsStore';
import { acknowledgeScheduledExecution, reconcileScheduledExecutions, syncAuditWakeup } from '@/services/scheduleWakeup';
import { loadScheduledAudits } from '@/services/auditSchedule';
import i18n from '@/i18n';
const loadToolsStore = () => import('@/stores/toolsStore');

export const useAppHydration = () => {
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const loadDataForSeoCredentials = useSettingsStore(s => s.loadDataForSeoCredentials);
  const loadGoogleMetricsApiKey = useSettingsStore(s => s.loadGoogleMetricsApiKey);
  const hydrateProject = useAuditStore(s => s.hydrateProject);
  const hydrateCredentials = useAuthStore(s => s.hydrateCredentials);
  const detectLocalClients = useAuthStore(s => s.detectLocalClients);
  const hydrateAiProject = useAuthStore(s => s.hydrateProject);
  useEffect(() => {
    void hydrateCredentials();
    void detectLocalClients();
  }, [hydrateCredentials, detectLocalClients]);
  useEffect(() => {
    if (activeProjectId) hydrateAiProject(activeProjectId);
    hydrateProject(activeProjectId);
    useWorkspaceIndicatorsStore.getState().reset();
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    if (activeProjectId) {
      void loadToolsStore()
        .then(async ({ useToolsStore }) => {
          await useToolsStore.getState().hydrateProject(activeProjectId);
          const handoffs = await reconcileScheduledExecutions(activeProjectId).catch(() => []);
          if (activeProjectId === useProjectStore.getState().activeProjectId) {
            for (const handoff of handoffs) {
              let persisted = true;
              if (handoff.taskType === 'page-audit') {
                persisted = handoff.result
                  ? useAuditStore.getState().importScheduledAuditResult(handoff.result)
                  : false;
              } else if (handoff.taskType === 'site-crawl') {
                persisted = handoff.result
                  ? await useToolsStore.getState().importScheduledCrawlResult(handoff.result, `${handoff.scheduleId}-${handoff.completedAt}`)
                  : false;
              }
              if (persisted || (!handoff.succeeded && !handoff.result)) {
                await acknowledgeScheduledExecution(activeProjectId, handoff.scheduleId).catch(() => undefined);
              }
            }
          }
          // Upgrade schedules created before the native manifest existed and
          // keep the OS wake-up aligned after a project is reopened.
          await Promise.all(loadScheduledAudits(activeProjectId).map((schedule) => syncAuditWakeup(activeProjectId, schedule).catch(() => undefined)));
          if (disposed) return;
          const syncIndicators = () => {
            const state = useToolsStore.getState();
            useWorkspaceIndicatorsStore.getState().setSnapshot({
              savedKeywordsCount: state.savedKeywords.length,
              trackedRanksCount: state.trackedRanks.length,
              isCrawling: state.isCrawling,
              crawlProgress: state.crawlProgress,
              crawlRunsCount: state.crawlRuns.length,
            });
          };
          syncIndicators();
          unsubscribe = useToolsStore.subscribe(syncIndicators);
        })
        .catch((error) => console.error(i18n.t('runtimeErrors.app.toolsHydrateFailed'), error));
      void loadDataForSeoCredentials();
      void loadGoogleMetricsApiKey();
    }
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [activeProjectId, hydrateAiProject, hydrateProject, loadDataForSeoCredentials, loadGoogleMetricsApiKey]);
};
