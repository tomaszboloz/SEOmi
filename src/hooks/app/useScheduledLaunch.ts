import { useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { isTauriEnvironment } from '@/services/tauri';
import { getScheduledLaunchContext } from '@/services/scheduleWakeup';

export const useScheduledLaunch = () => {
  const projects = useProjectStore(s => s.projects);
  const selectProject = useProjectStore(s => s.selectProject);
  const [scheduledLaunchContext, setScheduledLaunchContext] = useState<{ projectId: string | null; scheduleId: string | null; headless: boolean }>({ projectId: null, scheduleId: null, headless: false });
  const [scheduledLaunchContextReady, setScheduledLaunchContextReady] = useState(() => !isTauriEnvironment());
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
  return { scheduledLaunchContext, setScheduledLaunchContext, scheduledLaunchContextReady };
};
