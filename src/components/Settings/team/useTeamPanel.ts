import { useCallback, useEffect, useState } from 'react';
import { useProjectStore } from '@/stores/projectStore';
import { downloadText } from '@/services/export/download';
import { exportAuditCsv, verifyChain, type AuditEntry, type ChainVerdict } from '@/services/team/auditLog';
import { readAuditLog, recordAudit } from '@/services/team/auditStore';
import { TEAM_CONTEXT_KEY, readIdentity, type TeamIdentity } from '@/services/team/identity';

export { TEAM_CONTEXT_KEY, readIdentity, type TeamIdentity };

/** Acting identity plus the hash-chained audit log; every role or actor change is appended to the log. */
export const useTeamPanel = () => {
  const projectId = useProjectStore((s) => s.activeProjectId) ?? 'no-project';
  const [identity, setIdentity] = useState<TeamIdentity>(readIdentity);
  const [log, setLog] = useState<AuditEntry[]>(() => readAuditLog(localStorage));
  const [verdict, setVerdict] = useState<ChainVerdict>({ ok: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void verifyChain(log).then(setVerdict); }, [log]);

  const update = useCallback(async (next: TeamIdentity) => {
    try {
      await recordAudit(localStorage, { actor: next.actor, role: next.role, action: 'team_identity_change', projectId, result: 'success', metadata: { previousRole: identity.role, previousActor: identity.actor } });
      localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify(next));
      setIdentity(next);
      setLog(readAuditLog(localStorage));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [identity, projectId]);

  const exportCsv = useCallback(() => downloadText('seomi-audit-log.csv', exportAuditCsv(log), 'text/csv'), [log]);
  return { identity, log, verdict, error, update, exportCsv };
};
