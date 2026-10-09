import { useEffect } from 'react';
import type { useScheduledLaunch } from './useScheduledLaunch';
import { useProjectStore } from '@/stores/projectStore';
import { useAuditStore } from '@/stores/auditStore';
import { AUDIT_SCHEDULES_UPDATED_EVENT, claimDueScheduledAudit, finishScheduledAudit, loadScheduledAudits, type ScheduledAudit } from '@/services/auditSchedule';
import { isTauriEnvironment } from '@/services/tauri';
import { syncAuditWakeup } from '@/services/scheduleWakeup';
import { notifyCrawlCompleted, notifyScheduledAuditReminder } from '@/services/desktopNotifications';
import i18n from '@/i18n';
const defaultToolsStore = () => import('@/stores/toolsStore');

export const useAppScheduler = ({ scheduledLaunchContext, setScheduledLaunchContext, scheduledLaunchContextReady }: ReturnType<typeof useScheduledLaunch>, loadToolsStore = defaultToolsStore) => {
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActiveTab = useAuditStore(s => s.setActiveTab);
  useEffect(() => {
    if (!activeProjectId || !isTauriEnvironment() || !scheduledLaunchContextReady || scheduledLaunchContext.headless) return;
    let disposed = false;
    let checking = false;
    const runDueSchedule = async () => {
      if (disposed || checking) return;
      // Reminders are best-effort and project-scoped; they do not block or
      // trigger the scheduled task itself.
      void notifyScheduledAuditReminder(activeProjectId);
      const { useToolsStore } = await loadToolsStore();
      // Component/project and busy state can change while the module loads.
      if (disposed || checking || useProjectStore.getState().activeProjectId !== activeProjectId) return;
      const audit = useAuditStore.getState();
      if (audit.isLoading || audit.isBatchRunning || useToolsStore.getState().isCrawling) return;
      const launchScheduleId = scheduledLaunchContext.projectId === activeProjectId
        ? scheduledLaunchContext.scheduleId || undefined
        : undefined;
      let schedule: ScheduledAudit | null;
      try {
        schedule = claimDueScheduledAudit(activeProjectId, Date.now(), launchScheduleId);
      } catch (error) {
        console.error(i18n.t('runtimeErrors.app.scheduleReadFailed'), error);
        return;
      }
      if (!schedule) return;
      checking = true;
      let succeeded = false;
      let failure: string | undefined;
      try {
        if (schedule.taskType === 'site-crawl') {
          setActiveTab('site-audit');
          const previousRun = useToolsStore.getState().crawlRuns.find((run) => run.startUrl === schedule.url);
          const crawl = await useToolsStore.getState().startSiteCrawl(schedule.url, schedule.crawlLimit, schedule.crawlConfig, 'default', false);
          succeeded = Boolean(crawl);
          if (crawl) {
            const completedRun = useToolsStore.getState().crawlRuns.find((run) => run.result === crawl);
            const runId = completedRun?.id || `scheduled-crawl-${schedule.id}-${schedule.lastStartedAt || schedule.nextRunAt || 'unknown'}`;
            void notifyCrawlCompleted(activeProjectId, crawl, previousRun?.result, { runId });
          } else {
            failure = useToolsStore.getState().crawlError || undefined;
          }
        } else {
          succeeded = await useAuditStore.getState().startAudit(schedule.url);
          if (!succeeded) failure = useAuditStore.getState().error || undefined;
        }
      } catch (error) {
        failure = error instanceof Error ? error.message : String(error);
      } finally {
        try {
          finishScheduledAudit(activeProjectId, schedule.id, succeeded, failure);
          const next = loadScheduledAudits(activeProjectId).find((item) => item.id === schedule.id);
          void syncAuditWakeup(activeProjectId, next).catch(() => undefined);
          if (!disposed && useProjectStore.getState().activeProjectId === activeProjectId && launchScheduleId === schedule.id) setScheduledLaunchContext({ projectId: null, scheduleId: null, headless: false });
        } catch (error) {
          console.error(i18n.t('runtimeErrors.app.schedulePersistFailed'), error);
        }
        checking = false;
      }
    };
    void runDueSchedule();
    const timer = window.setInterval(() => void runDueSchedule(), 30_000);
    const handleScheduleUpdated = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (!projectId || projectId === activeProjectId) void runDueSchedule();
    };
    // A manual "Uruchom teraz" action should not wait for the polling window.
    // The event remains project-scoped so editing another project's schedule
    // cannot interrupt an active audit in the current workspace.
    window.addEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, handleScheduleUpdated);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener(AUDIT_SCHEDULES_UPDATED_EVENT, handleScheduleUpdated);
    };
  }, [activeProjectId, scheduledLaunchContext, scheduledLaunchContextReady, loadToolsStore]);
};
