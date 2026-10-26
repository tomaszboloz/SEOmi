import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TEAM_CONTEXT_KEY } from '@/services/team/identity';
import { AUDIT_STORAGE_KEY, readAuditLog } from '@/services/team/auditStore';
import { approve, backup, button, dryRun, prepare, setup, transport } from './fixtures/cmsPanelHarness';

it.each(['seo_strategist', 'content_writer'])('denies dry run for %s synchronously with the existing message', async (role) => {
  const cms = setup(); await prepare(); approve();
  localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'local', role }));
  fireEvent.click(button('Run dry run'));
  expect(screen.getByRole('alert').textContent).toBe('Your role cannot perform this action.');
  expect(cms.state.requests).toHaveLength(1);
  expect(backup).not.toHaveBeenCalled();
  await waitFor(() => expect(readAuditLog(localStorage).at(-1)?.result).toBe('denied'));
});

it('rechecks permissions immediately before a live write', async () => {
  const cms = setup(); await prepare(); approve(); await dryRun();
  localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'local', role: 'content_writer' }));
  fireEvent.click(button('Apply approved diff'));
  expect(screen.getByRole('alert').textContent).toContain('cannot perform');
  expect(cms.state.requests).toHaveLength(1);
});

it('invalidates consent if the acting person changes after approval', async () => {
  setup(); await prepare(); approve(); await dryRun();
  localStorage.setItem(TEAM_CONTEXT_KEY, JSON.stringify({ actor: 'other', role: 'admin' }));
  fireEvent.click(button('Apply approved diff'));
  expect(screen.getByRole('alert').textContent).toBe('Approve this exact diff before writing.');
  expect(button('Apply approved diff').disabled).toBe(true);
});

it('refuses a page revision changed after approval', async () => {
  const cms = setup(); await prepare(); approve(); await dryRun(); cms.state.rev += 1;
  fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Prepare the diff again.'));
  expect(backup).not.toHaveBeenCalled();
  expect(cms.state.requests.every((request) => request.method === 'GET')).toBe(true);
  expect(button('Apply approved diff').disabled).toBe(true);
});

it('reports an unverified write instead of success', async () => {
  const cms = setup(); await prepare(); approve(); await dryRun();
  transport.mockImplementation(async (request) => {
    const response = await cms.send(request);
    if (request.method !== 'GET') cms.state.content = '<h2>Pricing</h2><p>not the change</p>';
    return response;
  });
  fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Change written, but the live page does not show it yet.'));
  expect(readAuditLog(localStorage).at(-1)?.metadata?.verified).toBe(false);
});

it('stops writes when encrypted backup persistence fails', async () => {
  const cms = setup(); await prepare(); approve(); await dryRun(); backup.mockRejectedValueOnce(new Error('disk full'));
  fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('CMS patch failed: disk full'));
  expect(cms.state.requests.every((request) => request.method === 'GET')).toBe(true);
});

it('reports native/transport rejection on write and revokes dry-run eligibility', async () => {
  const cms = setup(); await prepare(); approve(); await dryRun(); cms.state.status = 503;
  fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The CMS rejected the request.'));
  expect(button('Apply approved diff').disabled).toBe(true);
});

it('reports a failed dry run when the audit log cannot be extended', async () => {
  setup(); await prepare(); approve();
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([{ seq: 1, hash: 'bad', prevHash: '', id: 'bad' }]));
  fireEvent.click(button('Run dry run'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('CMS patch failed:'));
  expect(backup).not.toHaveBeenCalled();
});

it('requires fact-gate confirmation for YMYL and invalidates approval when it changes', async () => {
  setup(); fireEvent.click(screen.getByLabelText('Health, finance or legal content (YMYL)'));
  await prepare(); approve(); await dryRun(); fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('YMYL content needs a passed fact check before writing.'));
  fireEvent.click(screen.getByLabelText('The required fact check has passed for this exact diff'));
  expect(button('Run dry run').disabled).toBe(true);
  approve(); await dryRun(); fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Change written and verified.'));
});
