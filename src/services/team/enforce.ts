import { useProjectStore } from '@/stores/projectStore';
import i18n from '@/i18n';
import { can, type Permission } from './roles';
import { readIdentity } from './identity';
import { recordAudit } from './auditStore';

/**
 * Decides synchronously with the role table and queues the decision for the audit trail. The decision
 * never depends on log health: a broken or unwritable log is reported by the team panel, but cannot
 * lock the user out. Being synchronous keeps callers' own state snapshots race-free.
 */
export const enforcePermission = (permission: Permission, metadata: Record<string, string | number | boolean | null> = {}): boolean => {
  const { actor, role } = readIdentity();
  const allowed = can(role, permission);
  const projectId = useProjectStore.getState().activeProjectId ?? 'no-project';
  recordAudit(localStorage, { actor, role, action: permission, projectId, result: allowed ? 'success' : 'denied', metadata }).catch(() => {
    // Audit failure is surfaced by the team panel's chain verdict.
  });
  return allowed;
};

export const deniedMessage = (): string => i18n.t('teamUi.denied');

/** Throws a user-facing error when the acting role lacks the permission. */
export const requireAllowed = (permission: Permission, metadata?: Record<string, string | number | boolean | null>): void => {
  if (!enforcePermission(permission, metadata)) throw new Error(deniedMessage());
};
