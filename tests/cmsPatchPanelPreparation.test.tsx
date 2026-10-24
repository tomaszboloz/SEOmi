import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';
import { button, change, prepare, renderPanel, setup, transport } from './fixtures/cmsPanelHarness';

it.each(['http://cms.example.com', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.1',
  'https://[::1]', 'https://cms.internal', 'https://user:password@cms.example.com', 'not a URL'])('blocks unsafe URL %s before transport', async (url) => {
  setup(); change('CMS base URL (HTTPS)', url); fireEvent.click(button('Prepare diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The CMS address is not allowed (HTTPS and a public host are required).'));
  expect(transport).not.toHaveBeenCalled();
});

it.each([new Error('offline'), 'offline'])('renders a preparation failure: %s', async (reason) => {
  setup(); transport.mockRejectedValueOnce(reason); fireEvent.click(button('Prepare diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('CMS patch failed: offline'));
  expect(button('Prepare diff').disabled).toBe(false);
  await prepare();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('renders heading errors from the existing namespace', async () => {
  setup(); change('Heading to find', 'Missing'); fireEvent.click(button('Prepare diff'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('The heading was not found in the page.'));
});

it('requires an active project and complete inputs, including the Strapi collection', () => {
  useProjectStore.setState({ activeProjectId: null as never }); renderPanel();
  expect(screen.getByText('Select an active project to prepare a CMS patch.')).toBeTruthy();
  expect(button('Prepare diff').disabled).toBe(true);
});

it('requires all form fields and a nonempty Strapi collection', () => {
  setup('strapi');
  change('Strapi collection', ' '); expect(button('Prepare diff').disabled).toBe(true);
  change('Strapi collection', 'articles'); expect(button('Prepare diff').disabled).toBe(false);
  change('Content ID', ' '); expect(button('Prepare diff').disabled).toBe(true);
});

it.each([false, true])('ignores pending preparation after switching projects (reject=%s)', async (reject) => {
  const cms = setup();
  let resolve!: (value: Awaited<ReturnType<typeof cms.send>>) => void;
  let fail!: (reason: unknown) => void;
  transport.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; fail = no; }));
  fireEvent.click(button('Prepare diff'));
  expect(screen.getByRole('status').textContent).toBe('Processing CMS patch…');
  expect(button('Prepare diff').disabled).toBe(true);
  await act(async () => { useProjectStore.setState({ activeProjectId: 'other-project' }); });
  await act(async () => {
    if (reject) fail(new Error('old project error'));
    else resolve({ status: 200, headers: {}, body: JSON.stringify({ content: { raw: cms.state.content }, modified_gmt: '1' }) });
  });
  expect(screen.queryByRole('region', { name: 'Proposed diff' })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect((screen.getByLabelText('Content ID') as HTMLInputElement).value).toBe('');
});

it('drops approval, dry-run status and input on project changes', async () => {
  setup(); await prepare();
  await act(async () => { useProjectStore.setState({ activeProjectId: 'other-project' }); });
  expect(screen.queryByLabelText('I approve this exact diff')).toBeNull();
});
