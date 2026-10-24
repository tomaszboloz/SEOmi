export const ROLES = ['admin', 'seo_strategist', 'content_writer', 'developer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = ['run_crawl', 'execute_cms_patch', 'modify_site_focus_rules', 'export_audit_pdf', 'manage_team_roles'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Single source of truth; a role not listed here has no rights. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  admin: PERMISSIONS,
  seo_strategist: ['run_crawl', 'modify_site_focus_rules', 'export_audit_pdf'],
  content_writer: ['export_audit_pdf'],
  developer: ['run_crawl', 'execute_cms_patch'],
};

export const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLES as readonly string[]).includes(value);

export const can = (role: unknown, permission: Permission): boolean =>
  isRole(role) && ROLE_PERMISSIONS[role].includes(permission);

export class PermissionError extends Error {
  constructor(readonly role: unknown, readonly permission: Permission) {
    super(`Role ${String(role)} lacks permission ${permission}`);
    this.name = 'PermissionError';
  }
}

export const requirePermission = (role: unknown, permission: Permission): void => {
  if (!can(role, permission)) throw new PermissionError(role, permission);
};
