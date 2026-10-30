import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { backup, transport } from './fixtures/cmsPanelHarness';
import { useCmsPatchPanel, type CmsPanelController } from '@/components/Settings/cms/useCmsPatchPanel';
import { mockCms } from './fixtures/cmsMock';

const ready = (controller: CmsPanelController) => {
  controller.update('baseUrl', 'https://cms.example.com');
  controller.update('contentId', '7');
  controller.update('heading', 'Pricing');
  controller.update('replacement', '<p>new</p>');
};
const setupHook = async () => {
  const cms = mockCms('wordpress');
  transport.mockImplementation(cms.send);
  const hook = renderHook(() => useCmsPatchPanel('cms-project'));
  act(() => ready(hook.result.current));
  await act(() => hook.result.current.prepare());
  act(() => hook.result.current.approve(true));
  return { ...hook, cms };
};

it('rejects an invented YMYL dose with a localized message and keeps the fact gate closed (#137)', async () => {
  transport.mockImplementation(mockCms('wordpress').send);
  const { result } = renderHook(() => useCmsPatchPanel('cms-project'));
  act(() => ready(result.current));
  act(() => { result.current.update('ymyl', true); result.current.update('replacement', '<p>Take 750 mg twice a day.</p>'); });
  await act(() => result.current.prepare());
  act(() => result.current.confirmFacts(true));
  expect(result.current.factGatePassed).toBe(false);
  expect(result.current.error).toBe('YMYL content needs a passed fact check before writing.');
});

it('keeps incomplete, absent-project, absent-plan and absent-approval calls inert', async () => {
  const { result, rerender } = renderHook(({ projectId }) => useCmsPatchPanel(projectId), {
    initialProps: { projectId: null as string | null },
  });
  act(() => result.current.approve(true));
  await act(() => result.current.execute(true));
  await act(() => result.current.prepare());
  rerender({ projectId: 'cms-project' });
  await act(() => result.current.execute(true));
  expect(transport).not.toHaveBeenCalled();
  transport.mockImplementation(mockCms('wordpress').send);
  act(() => ready(result.current));
  await act(() => result.current.prepare());
  await act(() => result.current.execute(true));
  expect(transport).toHaveBeenCalledOnce();
});

it('cannot apply before dry run and prevents duplicate concurrent operations', async () => {
  const { result } = await setupHook();
  await act(() => result.current.execute(false));
  expect(backup).not.toHaveBeenCalled();
  await act(async () => {
    const pending = result.current.execute(true);
    await result.current.execute(true);
    await result.current.prepare();
    await pending;
  });
  expect(transport).toHaveBeenCalledOnce();
  expect(result.current.status).toBe('dry-run');
});

it.each([false, true])('discards an invalidated preparation result (reject=%s)', async (reject) => {
  let resolve!: (value: unknown) => void;
  let fail!: (reason: unknown) => void;
  transport.mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; fail = no; }));
  const { result } = renderHook(() => useCmsPatchPanel('cms-project'));
  act(() => ready(result.current));
  let pending!: Promise<void>;
  act(() => { pending = result.current.prepare(); });
  expect(result.current.busy).toBe(true);
  await act(() => result.current.prepare());
  act(() => result.current.update('contentId', '8'));
  await act(async () => {
    if (reject) fail('outdated error');
    else resolve({ status: 200, headers: {}, body: JSON.stringify({ content: { raw: '<h2>Pricing</h2>old' }, modified_gmt: '1' }) });
    await pending;
  });
  expect(result.current.plan).toBeNull();
  expect(result.current.error).toBeNull();
  expect(result.current.busy).toBe(false);
});

it('discards dry-run results if the inputs change during the operation', async () => {
  const { result } = await setupHook();
  let pending!: Promise<void>;
  act(() => { pending = result.current.execute(true); });
  act(() => result.current.update('contentId', '8'));
  await act(() => pending);
  expect(result.current.status).toBeNull();
  expect(result.current.dryRunHash).toBeNull();
});

it('discards stale write failures after invalidation', async () => {
  const { result } = await setupHook();
  await act(() => result.current.execute(true));
  let fail!: (reason: unknown) => void;
  backup.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
  let pending!: Promise<void>;
  act(() => { pending = result.current.execute(false); });
  await waitFor(() => expect(backup).toHaveBeenCalledOnce());
  act(() => result.current.update('contentId', '8'));
  await act(async () => { fail('outdated backup error'); await pending; });
  expect(result.current.error).toBeNull();
  expect(result.current.busy).toBe(false);
});
