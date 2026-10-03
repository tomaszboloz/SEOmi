import { cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountScheduler, resetScheduler, scheduler, scheduleFixture, settleScheduler, updateSchedule } from './fixtures/appSchedulerContracts';
beforeEach(resetScheduler);
afterEach(async () => { cleanup(); await vi.dynamicImportSettled(); await settleScheduler(); vi.restoreAllMocks(); });

it('runs due page audit with exact launch ID, persists outcome, reschedules and clears matching launch', async () => {
  const schedule = scheduleFixture(); const next = {...schedule, nextRunAt:'2026-10-04'};
  scheduler.claim.mockReturnValueOnce(schedule); scheduler.load.mockReturnValue([next]);
  await mountScheduler({projectId:'project-a', scheduleId:'schedule-a', headless:false});
  await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.claim).toHaveBeenCalledWith('project-a', expect.any(Number), 'schedule-a');
  expect(scheduler.audit.startAudit).toHaveBeenCalledExactlyOnceWith('https://example.test/');
  expect(scheduler.finish).toHaveBeenCalledWith('project-a', 'schedule-a', true, undefined);
  expect(scheduler.sync).toHaveBeenCalledWith('project-a', next);
  expect(scheduler.setContext).toHaveBeenCalledWith({projectId:null, scheduleId:null, headless:false});
});
it('does not force another project launch ID or clear unrelated launch context', async () => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture());
  await mountScheduler({projectId:'project-b', scheduleId:'schedule-b', headless:false});
  await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.claim).toHaveBeenCalledWith('project-a', expect.any(Number), undefined);
  expect(scheduler.sync).toHaveBeenCalledWith('project-a', undefined);
  expect(scheduler.setContext).not.toHaveBeenCalled();
});
it.each([null, 'observed audit failure'])('persists false audit outcome and exact error %s', async error => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); scheduler.audit.startAudit.mockResolvedValue(false); scheduler.audit.error=error;
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.finish).toHaveBeenCalledWith('project-a', 'schedule-a', false, error || undefined);
});
it.each([new Error('audit rejected'), 'audit cancelled'])('persists rejected audit failure: %s', async failure => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); scheduler.audit.startAudit.mockRejectedValue(failure);
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.finish).toHaveBeenCalledWith('project-a', 'schedule-a', false, failure instanceof Error ? failure.message : failure);
});
it('runs crawl with exact arguments and notifies with prior matching health score', async () => {
  const schedule=scheduleFixture('site-crawl'); const result={health_score:75};
  scheduler.claim.mockReturnValueOnce(schedule); scheduler.tools.startSiteCrawl.mockResolvedValue(result);
  scheduler.tools.crawlRuns=[{startUrl:'https://other.test/',result:{health_score:90}}, {startUrl:schedule.url,result:{health_score:60}}];
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.audit.setActiveTab).toHaveBeenCalledExactlyOnceWith('site-audit');
  expect(scheduler.tools.startSiteCrawl).toHaveBeenCalledExactlyOnceWith(schedule.url,25,schedule.crawlConfig,'default',false);
  expect(scheduler.complete).toHaveBeenCalledWith('project-a',result,60);
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
});
it('notifies a first completed crawl without inventing a prior health score', async () => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture('site-crawl')); scheduler.tools.startSiteCrawl.mockResolvedValue({health_score:75});
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.complete).toHaveBeenCalledWith('project-a',{health_score:75},undefined);
});
it.each([null, 'observed crawl failure'])('persists failed crawl error %s without completion notification', async error => {
  scheduler.claim.mockReturnValueOnce(scheduleFixture('site-crawl')); scheduler.tools.crawlError=error;
  await mountScheduler(); await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.finish).toHaveBeenCalledWith('project-a','schedule-a',false,error || undefined);
  expect(scheduler.complete).not.toHaveBeenCalled();
});
it('reports claim failure then permits a project-scoped retry', async () => {
  const consoleError=vi.spyOn(console,'error').mockImplementation(() => undefined);
  scheduler.claim.mockImplementationOnce(() => {throw new Error('read failure');});
  await mountScheduler(); await waitFor(() => expect(consoleError).toHaveBeenCalled());
  expect(scheduler.audit.startAudit).not.toHaveBeenCalled();
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); updateSchedule('project-a');
  await waitFor(() => expect(scheduler.finish).toHaveBeenCalled());
  expect(scheduler.audit.startAudit).toHaveBeenCalledOnce();
});
it('reports persistence failure and releases the busy guard for the next run', async () => {
  const consoleError=vi.spyOn(console,'error').mockImplementation(() => undefined);
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); scheduler.finish.mockImplementationOnce(() => {throw new Error('write failure');});
  await mountScheduler(); await waitFor(() => expect(consoleError).toHaveBeenCalled());
  expect(scheduler.sync).not.toHaveBeenCalled();
  scheduler.claim.mockReturnValueOnce(scheduleFixture()); updateSchedule();
  await waitFor(() => expect(scheduler.audit.startAudit).toHaveBeenCalledTimes(2)); await settleScheduler();
  expect(scheduler.sync).toHaveBeenCalledWith('project-a',undefined);
});
