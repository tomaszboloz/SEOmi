import { useEffect, useMemo, useReducer } from 'react';
import {
  PARITY_EXCEPTIONS_EVENT, parityExceptionsKey, readParityExceptions, setParityExceptionReason, toggleParityException,
} from '@/services/hreflangParity/exceptions';
import type { ParityExceptionHandlers } from '@/components/Charts/HreflangParityPanel';

/** Project-scoped local exceptions for the parity report; handlers are absent without a project. */
export const useParityExceptions = (projectId: string | null) => {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    const update = (event: Event) => {
      const key = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (projectId && (key === null || key === parityExceptionsKey(projectId))) refresh();
    };
    window.addEventListener(PARITY_EXCEPTIONS_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(PARITY_EXCEPTIONS_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [projectId]);
  const exceptions = useMemo(() => readParityExceptions(projectId), [projectId, revision]);
  const handlers = useMemo<ParityExceptionHandlers | undefined>(() => (projectId ? {
    onToggle: (language, topicKey) => { toggleParityException(projectId, language, topicKey); },
    onReason: (language, topicKey, reason) => { setParityExceptionReason(projectId, language, topicKey, reason); },
  } : undefined), [projectId]);
  return { exceptions, handlers };
};
