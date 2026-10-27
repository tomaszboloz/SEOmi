import { describe, expect, it } from 'vitest';
import { appendAudit, exportAuditCsv, exportAuditJson, verifyChain, GENESIS_HASH, type AuditEntry } from '@/services/team/auditLog';
import { AUDIT_STORAGE_KEY, readAuditLog, recordAudit, type KeyValueStore } from '@/services/team/auditStore';
import { authorize } from '@/services/team/guard';
import { PERMISSIONS, PermissionError, ROLES, can, isRole, requirePermission, type Permission, type Role } from '@/services/team/roles';
import en from '@/i18n/locales/en.json';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const base = { actor: 'ann', role: 'admin' as Role, projectId: 'p1' };

describe('permission matrix', () => {
  const expected: Record<Role, Permission[]> = {
    admin: [...PERMISSIONS],
    seo_strategist: ['run_crawl', 'modify_site_focus_rules', 'export_audit_pdf'],
    content_writer: ['export_audit_pdf'],
    developer: ['run_crawl', 'execute_cms_patch'],
  };
  it.each(ROLES)('%s has exactly its permissions', (role) => {
    expect(PERMISSIONS.filter((p) => can(role, p))).toEqual(expected[role].slice().sort((a, b) => PERMISSIONS.indexOf(a) - PERMISSIONS.indexOf(b)));
  });
  it('unknown roles have no rights and requirePermission throws', () => {
    expect(isRole('root')).toBe(false);
    expect(isRole(7)).toBe(false);
    expect(can('root', 'run_crawl')).toBe(false);
    expect(() => requirePermission('content_writer', 'execute_cms_patch')).toThrow(PermissionError);
    expect(() => requirePermission('developer', 'execute_cms_patch')).not.toThrow();
  });
  it('has labels for every role and permission in en', () => {
    for (const r of ROLES) expect(en.teamUi.role[r]).toBeTruthy();
    for (const p of PERMISSIONS) expect(en.teamUi.permission[p]).toBeTruthy();
  });
});

describe('audit hash chain', () => {
  const build = async (): Promise<AuditEntry[]> => {
    let log: AuditEntry[] = [];
    for (const [i, action] of ['a', 'b', 'c'].entries()) log = await appendAudit(log, { ...base, action, result: 'success', metadata: { n: i } }, `id${i}`, new Date(2026, 0, 1 + i));
    return log;
  };
  it('chains entries with monotonic seq and verifies', async () => {
    const log = await build();
    expect(log.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(log[0].prevHash).toBe(GENESIS_HASH);
    expect(log[1].prevHash).toBe(log[0].hash);
    expect(await verifyChain(log)).toEqual({ ok: true });
    expect(await verifyChain([])).toEqual({ ok: true });
  });
  it('detects edit, deletion, reorder', async () => {
    const log = await build();
    expect(await verifyChain([log[0], { ...log[1], result: 'denied' }, log[2]])).toEqual({ ok: false, brokenAt: 1, reason: 'hash' });
    expect(await verifyChain([log[0], log[2]])).toMatchObject({ ok: false, brokenAt: 1, reason: 'seq' });
    expect(await verifyChain([log[1], log[2]])).toMatchObject({ ok: false, brokenAt: 0 });
    expect(await verifyChain([log[0], { ...log[1], prevHash: 'x' }, log[2]])).toMatchObject({ reason: 'prev-hash' });
  });
  it('exports JSON and CSV with formula-injection guard', async () => {
    const log = await appendAudit([], { ...base, actor: '=cmd,"x"', action: 'run_crawl', result: 'success' }, 'i1');
    expect(JSON.parse(exportAuditJson(log))).toHaveLength(1);
    const csv = exportAuditCsv(log);
    expect(csv.split('\n')[0]).toContain('prevHash,hash');
    expect(csv).toContain(`"'=cmd,""x"""`);
  });
});

describe('persistent store and guard', () => {
  it('persists, reloads and refuses to extend a tampered log', async () => {
    const store = memory();
    const first = await recordAudit(store, { ...base, action: 'run_crawl', result: 'success' });
    expect(first.id).toMatch(/[0-9a-f-]{36}/);
    await recordAudit(store, { ...base, action: 'export_audit_pdf', result: 'success' });
    expect(readAuditLog(store)).toHaveLength(2);
    const log = JSON.parse(store.data.get(AUDIT_STORAGE_KEY) as string);
    log[0].actor = 'mallory';
    store.setItem(AUDIT_STORAGE_KEY, JSON.stringify(log));
    await expect(recordAudit(store, { ...base, action: 'x', result: 'success' })).rejects.toThrow(/tampered at entry 1/);
  });
  it('tolerates garbage storage', () => {
    const store = memory();
    store.setItem(AUDIT_STORAGE_KEY, '{bad');
    expect(readAuditLog(store)).toEqual([]);
    store.setItem(AUDIT_STORAGE_KEY, '{"a":1}');
    expect(readAuditLog(store)).toEqual([]);
    store.setItem(AUDIT_STORAGE_KEY, '[null,1]');
    expect(readAuditLog(store)).toEqual([]);
  });
  it('authorize logs allowed and denied decisions', async () => {
    const store = memory();
    const ok = await authorize(store, { actor: 'bob', role: 'developer', projectId: 'p' }, 'execute_cms_patch', { url: 'u' });
    const no = await authorize(store, { actor: 'cy', role: 'content_writer', projectId: 'p' }, 'execute_cms_patch');
    expect([ok.allowed, ok.entry.result, no.allowed, no.entry.result]).toEqual([true, 'success', false, 'denied']);
    expect(readAuditLog(store)).toHaveLength(2);
  });
});
