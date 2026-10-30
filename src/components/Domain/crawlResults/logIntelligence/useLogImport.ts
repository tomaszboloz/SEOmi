import { useEffect, useRef, useState } from 'react';
import { emptyImportState, importAccessLog, type LogImportState } from '@/services/logIntelligence';
import { hashLogFile, LOG_CHUNK_BYTES, LogFileError, readLogLines } from '@/services/logIntelligence/browserFile';
import { desktopResolver } from '@/services/logIntelligence/desktopResolver';
import { LogDecompressionError } from '@/services/logIntelligence/gzipLog';
import { clearLogState, readLogState, saveLogState } from '@/services/logIntelligence/storage';
import { rangesByFamily, readPublishedRanges } from '@/services/logIntelligence/publishedRanges';

const counters = ({ lines, malformed, ignoredNonBot }: LogImportState) => ({ lines, malformed, ignoredNonBot });

export const useLogImport = (projectId: string) => {
  const [state, setState] = useState(() => readLogState(projectId));
  const [progress, setProgress] = useState(() => counters(state));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cancelled = useRef(false);
  const working = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelled.current = true; };
  }, []);

  const importFile = async (file: File) => {
    if (working.current) return;
    working.current = true;
    cancelled.current = false;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const fileHash = await hashLogFile(file);
      if (cancelled.current) { if (mounted.current) setMessage('cancelled'); return; }
      if (state.inProgress && state.inProgress.hash !== fileHash && !state.fileHashes.includes(fileHash)) {
        throw new LogFileError('resumeRequired');
      }
      const next = await importAccessLog({ lines: readLogLines(file, LOG_CHUNK_BYTES, () => cancelled.current), fileHash, state, verify: { resolver: desktopResolver(), ranges: rangesByFamily(readPublishedRanges(projectId)) },
        shouldCancel: () => cancelled.current,
        onProgress: (current) => { if (mounted.current) setProgress(counters(current)); },
      });
      const saved = saveLogState(projectId, next);
      if (mounted.current) {
        setState(next);
        setProgress(counters(next));
        setMessage(next.inProgress ? 'cancelled' : state.fileHashes.includes(fileHash) ? 'duplicate' : 'complete');
        if (!saved) setError('storageFailed');
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof LogFileError || failure instanceof LogDecompressionError ? failure.code : 'importFailed');
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const clear = () => {
    if (working.current) return;
    const cleared = clearLogState(projectId);
    const empty = emptyImportState();
    setState(empty);
    setProgress(counters(empty));
    setMessage('');
    setError(cleared ? '' : 'storageFailed');
  };
  return { state, progress, busy, message, error, importFile, clear, cancel: () => { cancelled.current = true; } };
};
