import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { TeamPanel } from '@/components/Settings/TeamPanel';
import { TEAM_CONTEXT_KEY, readIdentity } from '@/components/Settings/team/useTeamPanel';
import { AUDIT_STORAGE_KEY, readAuditLog } from '@/services/team/auditStore';
import { verifyChain } from '@/services/team/auditLog';
import { PERMISSIONS, ROLES, can } from '@/services/team/roles';
import { useProjectStore } from '@/stores/projectStore';

const download = vi.hoisted(() => vi.fn());
vi.mock('@/services/export/download', () => ({ downloadText: download }));

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh'];

beforeEach(() => { localStorage.clear(); download.mockReset(); useProjectStore.setState({ activeProjectId: 'team-proj' }); });
afterEach(cleanup);

it('renders the permission matrix straight from the role table', () => {
  render(<TeamPanel />);
  const cells = screen.getAllByLabelText(/^(Allowed|Not allowed)$/);
  expect(cells).toHaveLength(ROLES.length * PERMISSIONS.length);
  const expected = PERMISSIONS.flatMap((permission) => ROLES.map((role) => (can(role, permission) ? 'Allowed' : 'Not allowed')));
  expect(cells.map((cell) => cell.getAttribute('aria-label'))).toEqual(expected);
  expect(screen.getByText('No audit entries yet.')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(true);
});

it('logs a role change in the hash chain, persists the identity and exports the log', async () => {
  render(<TeamPanel />);
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'developer' } });
  await waitFor(() => expect(readAuditLog(localStorage)).toHaveLength(1));
  const [entry] = readAuditLog(localStorage);
  expect(entry).toMatchObject({ action: 'team_identity_change', role: 'developer', projectId: 'team-proj', result: 'success', metadata: { previousRole: 'admin', previousActor: 'local' } });
  expect(JSON.parse(localStorage.getItem(TEAM_CONTEXT_KEY)!)).toEqual({ actor: 'local', role: 'developer' });
  expect(await verifyChain(readAuditLog(localStorage))).toEqual({ ok: true });
  expect(await screen.findByText('Audit chain verified.')).toBeTruthy();
  expect(screen.getByText('team_identity_change')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  expect(download).toHaveBeenCalledWith('seomi-audit-log.csv', expect.stringContaining('team_identity_change'), 'text/csv');
});

it('commits a changed actor on blur, ignores blank input and keeps the previous name', async () => {
  render(<TeamPanel />);
  const actor = screen.getByLabelText('Actor') as HTMLInputElement;
  fireEvent.change(actor, { target: { value: '  Ada  ' } });
  fireEvent.blur(actor);
  await waitFor(() => expect(readIdentity().actor).toBe('Ada'));
  fireEvent.change(actor, { target: { value: '   ' } });
  fireEvent.blur(actor);
  expect(actor.value).toBe('Ada');
  fireEvent.blur(actor);
  expect(readAuditLog(localStorage)).toHaveLength(1);
});

it('reports a tampered chain and refuses to extend it', async () => {
  render(<TeamPanel />);
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'content_writer' } });
  await waitFor(() => expect(readAuditLog(localStorage)).toHaveLength(1));
  const tampered = readAuditLog(localStorage).map((entry) => ({ ...entry, actor: 'mallory' }));
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(tampered));
  cleanup();
  render(<TeamPanel />);
  expect(await screen.findByText('Audit chain broken at entry 1 (hash).')).toBeTruthy();
  await act(async () => { fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } }); });
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Audit log tampered at entry 1'));
  expect(JSON.parse(localStorage.getItem(TEAM_CONTEXT_KEY)!).role).toBe('content_writer');
});

it('shows a non-Error write failure as text and keeps the previous identity', async () => {
  render(<TeamPanel />);
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw 'quota exceeded'; };
  try {
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'developer' } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('quota exceeded'));
  } finally { Storage.prototype.setItem = original; }
  expect(readIdentity().role).toBe('admin');
});

it('falls back to the default identity for missing, malformed or unknown stored values', () => {
  expect(readIdentity()).toEqual({ actor: 'local', role: 'admin' });
  localStorage.setItem(TEAM_CONTEXT_KEY, '{broken');
  expect(readIdentity()).toEqual({ actor: 'local', role: 'admin' });
  localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 5, role: 'root' }));
  expect(readIdentity()).toEqual({ actor: 'local', role: 'admin' });
  localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'Grace', role: 'seo_strategist' }));
  expect(readIdentity()).toEqual({ actor: 'Grace', role: 'seo_strategist' });
});

it('uses a placeholder project id without an active project', async () => {
  useProjectStore.setState({ activeProjectId: null as never });
  render(<TeamPanel />);
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'developer' } });
  await waitFor(() => expect(readAuditLog(localStorage)[0].projectId).toBe('no-project'));
});

it('translates the team panel completely in every locale', async () => {
  const english = (await import('@/i18n/locales/en.json')).default.teamPanelUi;
  const shape = (value: unknown): unknown => (value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)])) : 'string');
  for (const locale of LOCALES) {
    const block = (await import(`@/i18n/locales/${locale}.json`)).default.teamPanelUi;
    expect(shape(block), locale).toEqual(shape(english));
    expect(block.chainBroken, locale).toContain('{{entry}}');
    expect(block.chainBroken, locale).toContain('{{reason}}');
    if (locale !== 'en') expect(block.title, locale).not.toBe(english.title);
  }
});
