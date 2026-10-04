import { cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountScheduler, resetScheduler, scheduler, scheduleFixture, settleScheduler, updateSchedule } from './fixtures/appSchedulerContracts';
beforeEach(resetScheduler);
afterEach(async () => { cleanup(); await vi.dynamicImportSettled(); await settleScheduler(); vi.restoreAllMocks(); });

it.each(['missing project','browser','not ready','headless'])('does not register or run scheduler for %s', async condition => {
  const interval=vi.spyOn(window,'setInterval');
  if(condition==='missing project') scheduler.project=null;
  if(condition==='browser') scheduler.native=false;
  await mountScheduler({projectId:null,scheduleId:null,headless:condition==='headless'},condition!=='not ready');
  await settleScheduler();
  expect(scheduler.entered).not.toHaveBeenCalled(); expect(scheduler.claim).not.toHaveBeenCalled();
  expect(scheduler.reminder).not.toHaveBeenCalled(); expect(interval).not.toHaveBeenCalled();
});
it.each(['audit','batch','crawl'])('does not claim during busy %s operation', async busy => {
  scheduler.audit.isLoading=busy==='audit'; scheduler.audit.isBatchRunning=busy==='batch'; scheduler.tools.isCrawling=busy==='crawl';
  await mountScheduler(); await waitFor(() => expect(scheduler.loaded).toHaveBeenCalled()); await settleScheduler();
  expect(scheduler.reminder).toHaveBeenCalledWith('project-a');
  expect(scheduler.claim).not.toHaveBeenCalled(); expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
});
it('filters update events by project while permitting legacy events without detail', async () => {
  await mountScheduler(); await waitFor(() => expect(scheduler.claim).toHaveBeenCalledTimes(1));
  updateSchedule('project-b'); await settleScheduler(); expect(scheduler.claim).toHaveBeenCalledTimes(1);
  updateSchedule('project-a'); await waitFor(() => expect(scheduler.claim).toHaveBeenCalledTimes(2));
  window.dispatchEvent(new Event('schedule-update')); await waitFor(() => expect(scheduler.claim).toHaveBeenCalledTimes(3));
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
});
it('polls every 30 seconds and removes the timer/listener after cleanup', async () => {
  const interval=vi.spyOn(window,'setInterval'); const clear=vi.spyOn(window,'clearInterval');
  const add=vi.spyOn(window,'addEventListener'); const remove=vi.spyOn(window,'removeEventListener');
  const view=await mountScheduler(); await waitFor(() => expect(scheduler.claim).toHaveBeenCalledTimes(1));
  expect(interval).toHaveBeenCalledWith(expect.any(Function),30_000);
  const tick=interval.mock.calls[0][0] as () => void;
  tick(); await waitFor(() => expect(scheduler.claim).toHaveBeenCalledTimes(2));
  const listener=add.mock.calls.find(([name]) => name==='schedule-update')?.[1];
  view.unmount();
  expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
  expect(remove).toHaveBeenCalledWith('schedule-update',listener);
  tick(); updateSchedule(); await settleScheduler(); expect(scheduler.claim).toHaveBeenCalledTimes(2);
});
it('allows only one audit when update events arrive while the store import is pending', async () => {
  let release!: () => void; let finish!: (value:boolean) => void;
  scheduler.gate=new Promise<void>(resolve => {release=resolve;}); scheduler.claim.mockReturnValue(scheduleFixture());
  scheduler.audit.startAudit.mockImplementation(() => new Promise<boolean>(resolve => {finish=resolve;}));
  await mountScheduler(); await waitFor(() => expect(scheduler.entered).toHaveBeenCalled());
  updateSchedule(); updateSchedule('project-a'); release();
  await waitFor(() => expect(scheduler.audit.startAudit).toHaveBeenCalled()); await settleScheduler();
  expect(scheduler.claim).toHaveBeenCalledTimes(1); expect(scheduler.audit.startAudit).toHaveBeenCalledTimes(1);
  updateSchedule(); await settleScheduler(); expect(scheduler.claim).toHaveBeenCalledTimes(1);
  finish(true); await waitFor(() => expect(scheduler.finish).toHaveBeenCalledWith('project-a','schedule-a',true,undefined));
});
it('suppresses best-effort wakeup failure after recording the completed audit', async () => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); scheduler.sync.mockRejectedValue(new Error('wakeup unavailable'));
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled()); await settleScheduler();
  expect(scheduler.finish).toHaveBeenCalledWith('project-a','schedule-a',true,undefined);
  expect(scheduler.sync).toHaveBeenCalledWith('project-a',undefined);
});

it('loads the production tools-store boundary by default without an injected loader', async () => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture());
  await mountScheduler({projectId:null,scheduleId:null,headless:false},true,true);
  await waitFor(() => expect(scheduler.finish).toHaveBeenCalledWith('project-a','schedule-a',true,undefined));
  expect(scheduler.loader).not.toHaveBeenCalled();
  expect(scheduler.audit.startAudit).toHaveBeenCalledExactlyOnceWith('https://example.test/');
});
