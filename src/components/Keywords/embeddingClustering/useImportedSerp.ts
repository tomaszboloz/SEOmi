import { useEffect, useRef, useState } from 'react';
import type { SerpImportFormat } from '@/services/serpImport';
import { clearImportedSerp, readImportedSerp, saveImportedSerp } from './importedSerpStorage';

export const useImportedSerp = (projectId: string | null) => {
  const owner = useRef(projectId);
  owner.current = projectId;
  const [state, setState] = useState(() => ({ projectId, imported: readImportedSerp(projectId) }));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setState({ projectId, imported: readImportedSerp(projectId) });
    setError(null);
  }, [projectId]);
  const imported = state.projectId === projectId ? state.imported : null;
  const apply = (payload: string, format: SerpImportFormat) => {
    if (!projectId || owner.current !== projectId || state.projectId !== projectId) return;
    try {
      const next = saveImportedSerp(projectId, payload, format, new Date().toISOString());
      setState({ projectId, imported: next });
      setError(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
  };
  const clear = () => {
    if (!projectId || owner.current !== projectId || state.projectId !== projectId) return;
    if (!clearImportedSerp(projectId)) { setError('SERP import storage is unavailable'); return; }
    setState({ projectId, imported: null });
    setError(null);
  };
  return { imported, error, apply, clear };
};
