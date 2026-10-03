import { afterEach, expect, it, vi } from 'vitest';
import { validProjectId, isHttpUrlWithoutCredentials, parseSchedules } from '@/services/schedules/policy';
import { loadScheduledAudits, saveScheduledAudits, AUDIT_SCHEDULES_UPDATED_EVENT } from '@/services/schedules/persistence';
import i18n from '@/i18n';
import { applyScheduledExecution } from '@/services/schedules/handoff';
const record={id:'observed',url:'https://example.test/',intervalHours:24,enabled:true,status:'scheduled',createdAt:'2026-10-01T08:00:00Z',nextRunAt:'2026-10-02T08:00:00Z'};
afterEach(()=>vi.restoreAllMocks());
it.each([null,{},'broken',[{...record,nextRunAt:'invalid'}],[{...record,url:'javascript:alert(1)'}]])('rejects invalid persisted schedule evidence %j',value=>{
 expect(parseSchedules(value)).toEqual([]);
});
it.each([undefined,{},'invalid',[{startedAt:'invalid',completedAt:'invalid',succeeded:true}]])('replaces invalid run history with an empty validated list: %j',runHistory=>{
 const parsed=parseSchedules([{...record,runHistory}]);
 expect(parsed[0].runHistory).toEqual([]);
});
it('preserves valid bounded history and normalizes legacy task options',()=>{
 const history=Array.from({length:25},(_,index)=>({startedAt:'2026-10-01T08:00:00Z',completedAt:'2026-10-01T08:01:00Z',succeeded:index%2===0}));
 const parsed=parseSchedules([{...record,taskType:'site-crawl',crawlLimit:900,runHistory:history}]);
 expect(parsed[0]).toMatchObject({taskType:'site-crawl',crawlLimit:500,runHistory:history.slice(-20)});
 expect(history).toHaveLength(25);expect(parseSchedules(Array(30).fill(record))).toHaveLength(20);
 expect(parseSchedules([record])[0].taskType).toBe('page-audit');
});
it('validates project identifiers and HTTP URLs without credentials',()=>{
 expect(validProjectId('project-a')).toBe(true);expect(validProjectId('../outside')).toBe(false);expect(validProjectId('a'.repeat(81))).toBe(false);
 expect(isHttpUrlWithoutCredentials('https://example.test/path')).toBe(true);
 for(const value of [42,null,'https://user:secret@example.test','file:///tmp/private','bad URL','x'.repeat(2049)])expect(isHttpUrlWithoutCredentials(value)).toBe(false);
});
it('persists an isolated project list and emits only its opaque identifier',()=>{
 const listener=vi.fn();window.addEventListener(AUDIT_SCHEDULES_UPDATED_EVENT,listener);
 try {
  const list=parseSchedules([record]);saveScheduledAudits('project-a',list);
  expect(loadScheduledAudits('project-a')).toEqual(list);expect(loadScheduledAudits('project-b')).toEqual([]);
  expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({projectId:'project-a'});
 } finally {window.removeEventListener(AUDIT_SCHEDULES_UPDATED_EVENT,listener);}
});
it('exposes failed writes without emitting success or accepting an invalid project',()=>{
 const listener=vi.fn();window.addEventListener(AUDIT_SCHEDULES_UPDATED_EVENT,listener);
 try {
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('quota exceeded');});
  expect(()=>saveScheduledAudits('project-a',parseSchedules([record]))).toThrow(i18n.t('runtimeErrors.schedules.saveFailed'));
  expect(()=>saveScheduledAudits('../bad',[])).toThrow(i18n.t('runtimeErrors.schedules.projectRequired'));
  expect(listener).not.toHaveBeenCalled();expect(loadScheduledAudits('../bad')).toEqual([]);
 } finally {window.removeEventListener(AUDIT_SCHEDULES_UPDATED_EVENT,listener);}
});

it('reconciles a native handoff after discarding corrupted persisted history',()=>{
 localStorage.setItem('seomi_project_project-a_audit_schedules_v1',JSON.stringify([{...record,runHistory:{corrupted:true}}]));
 const handoff={projectId:'project-a',scheduleId:record.id,taskType:'page-audit',startedAt:'2026-10-01T09:00:00Z',completedAt:'2026-10-01T09:01:00Z',succeeded:true,nextRunAt:'2026-10-02T09:00:00Z'};
 const result=applyScheduledExecution('project-a',handoff);
 expect(result?.runHistory).toEqual([{startedAt:handoff.startedAt,completedAt:handoff.completedAt,succeeded:true}]);
 expect(loadScheduledAudits('project-a')[0].runHistory).toEqual(result?.runHistory);
});
