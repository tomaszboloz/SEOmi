import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { readAuditLog } from '@/services/team/auditStore';
import { approve, backup, button, change, dryRun, prepare, setup } from './fixtures/cmsPanelHarness';

it.each(['wordpress', 'strapi', 'webhook'] as const)('previews, approves, dry-runs and verifies %s without real network', async (kind) => {
  const cms = setup(kind);
  change('Stored credential name (optional)', 'cms_auth_demo');
  if (kind === 'strapi') change('Strapi collection', 'news');
  const preview = await prepare();
  expect(preview.textContent).toContain('- <p>old</p>');
  expect(preview.textContent).toContain('+ <p>new</p>');
  expect(preview.textContent).toContain('Source revision: 1');
  expect(button('Run dry run').disabled).toBe(true);
  expect(button('Apply approved diff').disabled).toBe(true);
  expect(cms.state.requests.every((request) => request.method === 'GET')).toBe(true);
  approve();
  expect(button('Apply approved diff').disabled).toBe(true);
  await dryRun();
  expect(backup).not.toHaveBeenCalled();
  expect(cms.state.requests).toHaveLength(1);
  expect(button('Apply approved diff').disabled).toBe(false);
  fireEvent.click(button('Apply approved diff'));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Change written and verified.'));
  expect(cms.state.content).toContain('<p>new</p>');
  expect(cms.state.content).toContain('<p>faq</p>');
  const write = cms.state.requests.find((request) => request.method !== 'GET')!;
  expect(write.headers['If-Match']).toBe('1');
  expect(write.credential).toBe('cms_auth_demo');
  expect(write.followRedirects).toBe(false);
  expect(backup).toHaveBeenCalledOnce();
  const [project, type, key, subject, bytes] = backup.mock.calls[0];
  expect([project, type, key, subject]).toEqual(['cms-project', 'cms-patch-backup', `${kind}:7:1`, 'cms-patch-backup']);
  expect(JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))).content).toContain('<p>old</p>');
  expect(readAuditLog(localStorage).at(-1)?.metadata?.verified).toBe(true);
  expect(button('Apply approved diff').disabled).toBe(true);
});

it.each([
  ['CMS base URL (HTTPS)', 'https://other.example.com'], ['Content ID', '8'],
  ['Heading to find', 'FAQ'], ['New section content (HTML or Markdown)', '<p>edited</p>'],
  ['Stored credential name (optional)', 'cms_auth_other'], ['CMS kind', 'webhook'],
] as const)('invalidates the exact diff and approval when %s changes', async (label, value) => {
  setup(); await prepare(); approve(); await dryRun();
  change(label, value);
  expect(screen.queryByRole('region', { name: 'Proposed diff' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Apply approved diff' })).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});

it('requires another dry run after approval is withdrawn or the plan is prepared again', async () => {
  setup(); await prepare(); approve(); await dryRun();
  approve(); expect(button('Run dry run').disabled).toBe(true);
  approve(); expect(button('Apply approved diff').disabled).toBe(true);
  await dryRun(); await prepare();
  expect((screen.getByLabelText('I approve this exact diff') as HTMLInputElement).checked).toBe(false);
  expect(button('Apply approved diff').disabled).toBe(true);
});

it('displays a no-change diff but offers no approval or write', async () => {
  setup(); change('New section content (HTML or Markdown)', '<p>old</p>');
  const preview = await prepare();
  expect(within(preview).getByRole('status').textContent).toContain('No changes.');
  expect(screen.queryByLabelText('I approve this exact diff')).toBeNull();
});

it('shows section HTML as text, never as executable markup', async () => {
  setup('webhook'); change('New section content (HTML or Markdown)', '<script>danger()</script>');
  const preview = await prepare();
  expect(preview.textContent).toContain('<script>danger()</script>');
  expect(preview.querySelector('script')).toBeNull();
});
