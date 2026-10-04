import { useCallback, useLayoutEffect, useRef } from 'react';
import { useAsyncOperationScope } from '@/hooks/useAsyncOperationScope';
import { useProjectStore } from '@/stores/projectStore';

export const useSettingsBackupScope = (projectId: string | null, clearStatus: (value: null) => void) => {
  const beginOperation = useAsyncOperationScope(null);
  const expectedProject = useRef(projectId);
  useLayoutEffect(() => {
    if (expectedProject.current === projectId) return;
    beginOperation('backup');
    expectedProject.current = projectId;
    clearStatus(null);
  }, [projectId, beginOperation, clearStatus]);
  return useCallback(() => {
    expectedProject.current = useProjectStore.getState().activeProjectId;
    const ownsOperation = beginOperation('backup');
    return {
      isCurrent: () => ownsOperation() && useProjectStore.getState().activeProjectId === expectedProject.current,
      selectProject: (id: string) => {
        if (!ownsOperation() || useProjectStore.getState().activeProjectId !== expectedProject.current) return;
        const previous = expectedProject.current;
        expectedProject.current = id;
        try { useProjectStore.getState().selectProject(id); }
        catch (error) { expectedProject.current = previous; throw error; }
      },
    };
  }, [beginOperation]);
};
