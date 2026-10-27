import type { AuditEntry } from './auditLog';
import { recordAudit, type KeyValueStore } from './auditStore';
import { can, type Permission, type Role } from './roles';

export interface TeamContext {
  actor: string;
  role: Role;
  projectId: string;
}

/** Checks the permission and writes the decision to the audit trail; a denial is logged, never silent. */
export const authorize = async (store: KeyValueStore, ctx: TeamContext, permission: Permission, metadata: Record<string, string | number | boolean | null> = {}): Promise<{ allowed: boolean; entry: AuditEntry }> => {
  const allowed = can(ctx.role, permission);
  const entry = await recordAudit(store, { ...ctx, action: permission, result: allowed ? 'success' : 'denied', metadata });
  return { allowed, entry };
};
