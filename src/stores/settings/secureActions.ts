import type { StoreApi } from 'zustand';
import { createSecureSaveQueue } from './secureSaveQueue';
import type { SettingsState } from './types';

/** Project-scoped keychain reads and writes shared by the settings store. */
export const createSecureActions = (set: StoreApi<SettingsState>['setState'], activeProjectId: () => string) => {
  const secureSaves = createSecureSaveQueue();

  // The project is captured before the save is queued: a later project switch
  // must neither redirect the write nor apply its result to the new project.
  const saveSecure = async (kind: string, write: (projectId: string) => Promise<unknown>, onSaved: () => void): Promise<void> => {
    const projectId = activeProjectId();
    const queueKey = `${kind}-${projectId}`;
    const revision = secureSaves.begin(queueKey);
    const current = () => activeProjectId() === projectId && secureSaves.isLatest(queueKey, revision);
    set({ isSaving: true, secureStorageError: null });
    const save = secureSaves.enqueue(queueKey, () => write(projectId));
    try {
      await save;
      if (current()) onSaved();
    } catch (error) {
      if (current()) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      secureSaves.settle(queueKey, save);
      if (secureSaves.pending === 0) set({ isSaving: false });
    }
  };

  // Clear the previous project's in-memory secret before awaiting the keychain,
  // so a fast project switch cannot use stale credentials, and ignore a read
  // that finishes after the project changed.
  const loadSecure = async (empty: Partial<SettingsState>, read: (projectId: string) => Promise<Partial<SettingsState>>): Promise<void> => {
    const projectId = activeProjectId();
    set({ ...empty, secureStorageError: null });
    if (!projectId) return;
    try {
      const loaded = await read(projectId);
      if (activeProjectId() === projectId) set(loaded);
    } catch (error) {
      if (activeProjectId() === projectId) set({ secureStorageError: error instanceof Error ? error.message : String(error) });
    }
  };

  return { loadSecure, saveSecure };
};
