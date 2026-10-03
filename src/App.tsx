import { useScheduledLaunch } from '@/hooks/app/useScheduledLaunch';
import { useCrawlEvidenceRouting } from '@/hooks/app/useCrawlEvidenceRouting';
import React, { lazy, Suspense } from 'react';
import { Header } from '@/components/Layout/Header';
import { Footer } from '@/components/Layout/Footer';
import { Sidebar } from '@/components/Layout/Sidebar';
import { MainContent } from '@/components/Layout/MainContent';
import { URLInput } from '@/components/URLBar/URLInput';
import { ProjectGate } from '@/components/Projects/ProjectGate';
import { useKeyboardShortcuts } from '@/hooks/useKeyboard';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAppStartup } from '@/hooks/app/useAppStartup';
import { useAppHydration } from '@/hooks/app/useAppHydration';
import { useAppRouting } from '@/hooks/app/useAppRouting';
import { useAppScheduler } from '@/hooks/app/useAppScheduler';

const SettingsModal = lazy(() => import('@/components/Settings/SettingsModal').then((module) => ({ default: module.SettingsModal })));
const AIAssistantModal = lazy(() => import('@/components/AI/AIAssistantModal').then((module) => ({ default: module.AIAssistantModal })));
const SubscriptionModal = lazy(() => import('@/components/Auth/SubscriptionModal').then((module) => ({ default: module.SubscriptionModal })));
const HistoryModal = lazy(() => import('@/components/History/HistoryModal').then((module) => ({ default: module.HistoryModal })));
const CreateProjectModal = lazy(() => import('@/components/Projects/CreateProjectModal').then((module) => ({ default: module.CreateProjectModal })));
const CommandPalette = lazy(() => import('@/components/Layout/CommandPalette').then((module) => ({ default: module.CommandPalette })));

export const App: React.FC = () => {
  useKeyboardShortcuts();
  useAppStartup();
  const launch = useScheduledLaunch();
  useCrawlEvidenceRouting();
  useAppHydration();
  useAppRouting();
  useAppScheduler(launch);
  const activeModal = useUIStore(s => s.activeModal);
  const activeProjectId = useProjectStore(s => s.activeProjectId);

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
    <div className="flex flex-col h-screen w-screen bg-[var(--color-bg-primary)] text-slate-100 overflow-hidden font-sans">
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
