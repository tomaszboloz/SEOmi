import { cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountScheduler, resetScheduler, scheduler, scheduleFixture, settleScheduler } from './fixtures/appSchedulerContracts';
beforeEach(resetScheduler);
afterEach(async () => { cleanup(); await vi.dynamicImportSettled(); await settleScheduler(); vi.restoreAllMocks(); });

it('does not claim or run a schedule when unmounted during store loading', async () => {
  let release!: () => void;
  scheduler.gate = new Promise<void>(resolve => {release = resolve;});
  scheduler.claim.mockReturnValue(scheduleFixture());
  const view = await mountScheduler();
  await waitFor(() => expect(scheduler.entered).toHaveBeenCalled());
  view.unmount(); release(); await settleScheduler();
  expect(scheduler.loaded).toHaveBeenCalled();
  expect(scheduler.claim).not.toHaveBeenCalled();
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
  expect(scheduler.finish).not.toHaveBeenCalled();
});
it('checks the current audit busy state after delayed store loading', async () => {
  let release!: () => void;
  scheduler.gate = new Promise<void>(resolve => {release = resolve;});
  scheduler.claim.mockReturnValue(scheduleFixture());
  await mountScheduler();
  await waitFor(() => expect(scheduler.entered).toHaveBeenCalled());
  scheduler.audit = {...scheduler.audit, isLoading:true};
  release(); await settleScheduler();
  expect(scheduler.loaded).toHaveBeenCalled();
  expect(scheduler.claim).not.toHaveBeenCalled();
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
});
it('does not claim the old project after active project changes during store loading', async () => {
  let release!: () => void;
  scheduler.gate = new Promise<void>(resolve => {release = resolve;});
  scheduler.claim.mockReturnValue(scheduleFixture());
  await mountScheduler();
  await waitFor(() => expect(scheduler.entered).toHaveBeenCalled());
  scheduler.project = 'project-b'; release(); await settleScheduler();
  expect(scheduler.claim).not.toHaveBeenCalled();
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
});

it.each(['unmount', 'project change'])('records an already started audit without clearing new launch context after %s', async change => {
  let finish!: (value:boolean) => void;
  scheduler.claim.mockReturnValueOnce(scheduleFixture());
  scheduler.audit.startAudit.mockImplementation(() => new Promise<boolean>(resolve => {finish=resolve;}));
  const view=await mountScheduler({projectId:'project-a',scheduleId:'schedule-a',headless:false});
  await waitFor(() => expect(scheduler.audit.startAudit).toHaveBeenCalled());
  if(change==='unmount') view.unmount(); else scheduler.project='project-b';
  finish(true); await settleScheduler();
  expect(scheduler.finish).toHaveBeenCalledWith('project-a','schedule-a',true,undefined);
  expect(scheduler.setContext).not.toHaveBeenCalled();
});
