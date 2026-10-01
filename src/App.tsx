import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Header } from '@/components/Layout/Header';
import { Footer } from '@/components/Layout/Footer';
import { Sidebar } from '@/components/Layout/Sidebar';
import { MainContent } from '@/components/Layout/MainContent';
import { URLInput } from '@/components/URLBar/URLInput';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useWorkspaceIndicatorsStore } from '@/stores/workspaceIndicatorsStore';
import { ProjectGate } from '@/components/Projects/ProjectGate';
import { useAuditStore } from '@/stores/auditStore';
import { useAuthStore } from '@/stores/authStore';
import { AUDIT_SCHEDULES_UPDATED_EVENT, claimDueScheduledAudit, finishScheduledAudit, type ScheduledAudit } from '@/services/auditSchedule';
import { invokeTauriCommand, isTauriEnvironment, type UpdateStatus } from '@/services/tauri';
import { notifyCrawlCompleted, notifyScheduledAuditReminder } from '@/services/desktopNotifications';
import { acknowledgeScheduledExecution, getScheduledLaunchContext, reconcileScheduledExecutions, syncAuditWakeup } from '@/services/scheduleWakeup';
import { loadScheduledAudits } from '@/services/auditSchedule';
import { buildWorkspaceHash, parseWorkspaceHash } from '@/services/workspaceDeepLink';
import i18n from '@/i18n';
import { connectSettingsStores } from '@/services/settingsComposition';

const loadToolsStore = () => import('@/stores/toolsStore');
const SettingsModal = lazy(() => import('@/components/Settings/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const AIAssistantModal = lazy(() => import('@/components/AI/AIAssistantModal').then((module) => ({ default: module.AIAssistantModal })));
const SubscriptionModal = lazy(() => import('@/components/Auth/SubscriptionModal').then((module) => ({ default: module.SubscriptionModal })));
const HistoryModal = lazy(() => import('@/components/History/HistoryModal').then((module) => ({ default: module.HistoryModal })));
const CreateProjectModal = lazy(() => import('@/components/Projects/CreateProjectModal').then((module) => ({ default: module.CreateProjectModal })));
const CommandPalette = lazy(() => import('@/components/Layout/CommandPalette').then((module) => ({ default: module.CommandPalette })));

export const App: React.FC = () => {
  // Initialize desktop keyboard shortcuts
  useKeyboardShortcuts();
  const [scheduledLaunchContext, setScheduledLaunchContext] = useState<{
    projectId: string | null;
    scheduleId: string | null;
    headless: boolean;
  }>({ projectId: null, scheduleId: null, headless: false });
  const handledWorkspaceHash = useRef<string | null>(null);
  const [scheduledLaunchContextReady, setScheduledLaunchContextReady] = useState(() => !isTauriEnvironment());

  const loadConfig = useSettingsStore((s) => s.loadConfig);
  const autoCheckUpdates = useSettingsStore((s) => s.config.auto_check_updates);
  const autoInstallUpdates = useSettingsStore((s) => s.config.auto_install_updates);
  const loadDataForSeoCredentials = useSettingsStore((s) => s.loadDataForSeoCredentials);
  const loadGoogleMetricsApiKey = useSettingsStore((s) => s.loadGoogleMetricsApiKey);
  const activeModal = useUIStore((s) => s.activeModal);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const selectProject = useProjectStore((s) => s.selectProject);
  const hydrateProject = useAuditStore((s) => s.hydrateProject);
  const setActiveTab = useAuditStore((s) => s.setActiveTab);
  const activeTab = useAuditStore((s) => s.activeTab);
  const hydrateCredentials = useAuthStore((s) => s.hydrateCredentials);
  const detectLocalClients = useAuthStore((s) => s.detectLocalClients);
  const hydrateAiProject = useAuthStore((s) => s.hydrateProject);
  const workspaceHashSyncSuppression = useRef<{ hash: string; tab: string } | null>(null);
  const pendingWorkspaceProject = useRef<{ hash: string; projectId: string } | null>(null);

  useEffect(() => {
    const disconnect = connectSettingsStores();
    loadConfig();
    return disconnect;
  }, [loadConfig]);

  useEffect(() => {
    if (!isTauriEnvironment() || !autoCheckUpdates) return;
    let disposed = false;
    const timer = window.setTimeout(() => {
      void invokeTauriCommand<UpdateStatus>('check_for_updates').then(async (status) => {
        if (disposed || !status.available || !autoInstallUpdates) return;
        const installed = await invokeTauriCommand<UpdateStatus>('install_update').catch(() => null);
        if (disposed || !installed?.installed) return;
        window.dispatchEvent(new CustomEvent('seomi-update-installed', { detail: installed }));
      }).catch(() => undefined);
    }, 3500);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [autoCheckUpdates, autoInstallUpdates]);

  useEffect(() => {
    if (!projects.length || !isTauriEnvironment()) return;
    let disposed = false;
    void getScheduledLaunchContext().then((context) => {
      if (disposed) return;
      setScheduledLaunchContext(context);
      setScheduledLaunchContextReady(true);
      if (!context.projectId || !projects.some((project) => project.id === context.projectId)) return;
      if (context.projectId !== useProjectStore.getState().activeProjectId) selectProject(context.projectId);
    }).catch(() => {
      if (!disposed) setScheduledLaunchContextReady(true);
    });
    return () => { disposed = true; };
  }, [projects, selectProject]);

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

  // Workspace destinations are hash-addressable so a copied local link can
  // reopen the same project and module after restarting the SPA. Crawl
  // evidence hashes intentionally keep precedence because they carry a run
  // and URL-level focus handled by the crawl results view.
  useEffect(() => {
    const openWorkspaceLink = () => {
      if (window.location.hash.startsWith('#crawl-evidence?')) return;
      if (handledWorkspaceHash.current === window.location.hash) return;
      const link = parseWorkspaceHash(window.location.hash);
      if (!link) {
        handledWorkspaceHash.current = window.location.hash;
        // A malformed or obsolete workspace hash must never remain visible
        // as a dead route. Once the active project is known, normalize it to
        // the safe overview destination and keep the rendered SPA state in
        // sync with the normalized URL. This also prevents a stale lazy
        // workflow from remaining visible after an invalid deep-link.
        if (activeProjectId) {
          setActiveTab('overview');
          const fallbackHash = buildWorkspaceHash({ projectId: activeProjectId, tab: 'overview' });
          if (fallbackHash && window.location.hash !== fallbackHash) {
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${window.location.search}${fallbackHash}`,
            );
          }
        }
        return;
      }
      // The project store may hydrate asynchronously. Keep the hash pending
      // until its project exists instead of permanently discarding a valid
      // deep-link during the first render.
      if (!projects.some((project) => project.id === link.projectId)) return;
      if (activeProjectId !== link.projectId) {
        pendingWorkspaceProject.current = { hash: window.location.hash, projectId: link.projectId };
        selectProject(link.projectId);
        return;
      }
      handledWorkspaceHash.current = window.location.hash;
      pendingWorkspaceProject.current = null;
      workspaceHashSyncSuppression.current = { hash: window.location.hash, tab: link.tab };
      setActiveTab(link.tab);
    };
    openWorkspaceLink();
    window.addEventListener('hashchange', openWorkspaceLink);
    return () => window.removeEventListener('hashchange', openWorkspaceLink);
  }, [activeProjectId, projects, selectProject, setActiveTab]);

  useEffect(() => {
    if (!activeProjectId || window.location.hash.startsWith('#crawl-evidence?')) return;
    const currentHash = window.location.hash;
    const currentLink = parseWorkspaceHash(currentHash);
    // A deep-link can target another valid project. Keep it intact while the
    // project store catches up; otherwise the stale render would overwrite
    // the link and bounce between projects before the target tab is applied.
    const pendingProject = pendingWorkspaceProject.current;
    if (
      currentLink
      && pendingProject?.hash === currentHash
      && pendingProject.projectId === currentLink.projectId
      && currentLink.projectId !== activeProjectId
      && projects.some((project) => project.id === currentLink.projectId)
    ) {
      return;
    }
    const suppression = workspaceHashSyncSuppression.current;
    if (suppression && suppression.hash === currentHash) {
      if (suppression.tab !== activeTab) return;
      workspaceHashSyncSuppression.current = null;
    }
    const nextHash = buildWorkspaceHash({ projectId: activeProjectId, tab: activeTab });
    if (!nextHash || currentHash === nextHash) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }, [activeProjectId, activeTab, projects]);

  useEffect(() => {
    if (!activeProjectId || !isTauriEnvironment() || !scheduledLaunchContextReady || scheduledLaunchContext.headless) return;
    let disposed = false;
    let checking = false;
    const runDueSchedule = async () => {
      if (disposed || checking) return;
      // Reminders are best-effort and project-scoped; they do not block or
      // trigger the scheduled task itself.
      void notifyScheduledAuditReminder(activeProjectId);
      const audit = useAuditStore.getState();
      const { useToolsStore } = await loadToolsStore();
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
            void notifyCrawlCompleted(activeProjectId, crawl, previousRun?.result.health_score);
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
          if (launchScheduleId === schedule.id) setScheduledLaunchContext({ projectId: null, scheduleId: null, headless: false });
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
  }, [activeProjectId, scheduledLaunchContext, scheduledLaunchContextReady]);

  if (!activeProjectId) {
    return (
      <>
        <ProjectGate />
        {activeModal === 'create-project' && (
          <Suspense fallback={null}>
            <CreateProjectModal />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Top Application Header */}
      <Header />

      {/* URL Audit Bar */}
      <URLInput />

      {/* Main Workspace: Sidebar & Active Tab Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>

      <Footer />

      {/* Active Modals */}
      {activeModal === 'ai' && (
        <Suspense fallback={null}>
          <AIAssistantModal />
        </Suspense>
      )}
      {activeModal === 'settings' && (
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
      )}
      {activeModal === 'subscription' && (
        <Suspense fallback={null}>
          <SubscriptionModal />
        </Suspense>
      )}
      {activeModal === 'history' && (
        <Suspense fallback={null}>
          <HistoryModal />
        </Suspense>
      )}
      {activeModal === 'create-project' && (
        <Suspense fallback={null}>
          <CreateProjectModal />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </div>
  );
};

export default App;
