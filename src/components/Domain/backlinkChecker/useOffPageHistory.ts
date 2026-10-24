import { useLayoutEffect, useState } from 'react';
import { clearOffPageHistory, deleteOffPageHistory, loadOffPageHistory } from '@/services/offPage/history';
import type { OffPageHistoryRecord } from '@/services/offPage/historySchema';

export const useOffPageHistory = (projectId: string | null, current: OffPageHistoryRecord | null) => {
  const [records, setRecords] = useState(() => loadOffPageHistory(projectId));
  const [error, setError] = useState(false);
  useLayoutEffect(() => { setRecords(loadOffPageHistory(projectId)); setError(false); }, [projectId, current]);
  const remove = (id: string) => {
    const success = deleteOffPageHistory(projectId, id);
    setError(!success);
    if (success) setRecords((previous) => previous.filter((record) => record.id !== id));
  };
  const clear = () => {
    const success = clearOffPageHistory(projectId);
    setError(!success);
    if (success) setRecords([]);
  };
  return { records, error, remove, clear };
};
