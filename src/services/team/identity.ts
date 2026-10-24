import { isRole, type Role } from './roles';

export const TEAM_CONTEXT_KEY = 'seomi:team:context';
export interface TeamIdentity { actor: string; role: Role }

export const DEFAULT_IDENTITY: TeamIdentity = { actor: 'local', role: 'admin' };

/** Stored acting identity; anything missing, malformed or unknown falls back to the local admin. */
export const readIdentity = (): TeamIdentity => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TEAM_CONTEXT_KEY) ?? 'null') as Partial<TeamIdentity> | null;
    const actor = typeof parsed?.actor === 'string' ? parsed.actor.trim().slice(0, 80) : '';
    return { actor: actor || DEFAULT_IDENTITY.actor, role: isRole(parsed?.role) ? parsed.role : DEFAULT_IDENTITY.role };
  } catch {
    return DEFAULT_IDENTITY;
  }
};
