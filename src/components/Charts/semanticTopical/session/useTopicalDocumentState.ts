import { useEffect, useRef, useState } from 'react';
import type { TopicalMapDocument } from '@/services/topicalMap';
import {
  topicalWorkspacePreferencesKey,
  type TopicalWorkspacePreferences,
} from '../workspaceHelpers';
import type { TopicalSessionDependencies } from './topicalSessionTypes';

interface Props {
  projectId: string | null;
  dependencies: TopicalSessionDependencies;
}

export const useTopicalDocumentState = ({
  projectId,
  dependencies,
}: Props) => {
  const [document, setDocument] = useState<TopicalMapDocument>(() =>
    projectId
      ? dependencies.readMap(projectId)
      : {
          schemaVersion: 1,
          entity: { name: '', description: '', facts: [] },
          nodes: [],
          updatedAt: new Date().toISOString(),
        },
  );
  const documentRef = useRef(document);
  const [loadedProjectId, setLoadedProjectId] = useState(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspacePreferences, setWorkspacePreferences] = useState(() =>
    dependencies.readPreferences(projectId),
  );
  const [preferencesProjectId, setPreferencesProjectId] = useState(projectId);
  const [saveError, setSaveError] = useState(false);
  const [preferencesSaveError, setPreferencesSaveError] = useState(false);

  useEffect(() => {
    if (loadedProjectId === projectId) return;
    const next = projectId
      ? dependencies.readMap(projectId)
      : {
          schemaVersion: 1 as const,
          entity: { name: '', description: '', facts: [] },
          nodes: [],
          updatedAt: new Date().toISOString(),
        };
    documentRef.current = next;
    setDocument(next);
    setSelectedId(null);
    setLoadedProjectId(projectId);
  }, [loadedProjectId, projectId, dependencies]);

  useEffect(() => {
    if (preferencesProjectId === projectId) return;
    setWorkspacePreferences(dependencies.readPreferences(projectId));
    setPreferencesProjectId(projectId);
  }, [preferencesProjectId, projectId, dependencies]);

  useEffect(() => {
    if (!projectId || preferencesProjectId !== projectId) return;
    setPreferencesSaveError(
      !dependencies.writePreferences(
        topicalWorkspacePreferencesKey(projectId),
        workspacePreferences,
      ),
    );
  }, [preferencesProjectId, projectId, workspacePreferences, dependencies]);

  const persist = (next: TopicalMapDocument) => {
    documentRef.current = next;
    setDocument(next);
    if (!projectId) return;
    try {
      const saved = dependencies.writeMap(projectId, next);
      documentRef.current = saved;
      setDocument(saved);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  };

  const updateWorkspacePreferences = (patch: Partial<TopicalWorkspacePreferences>) =>
    setWorkspacePreferences((current) => ({ ...current, ...patch }));

  return {
    document,
    documentRef,
    selectedId,
    setSelectedId,
    workspacePreferences,
    saveError,
    preferencesSaveError,
    persist,
    updateWorkspacePreferences,
  };
};
