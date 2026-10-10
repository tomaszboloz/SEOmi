import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { auditHostname, batchSnapshotFingerprint, beginAuditRequest, formatAuditRuntimeError, formatQueueWakeupError, isFiniteNumber, isLatestAuditRequest, parseBatchQueue, parseBatchRun, recoverInterruptedBatch } from '@/stores/audit/auditHelpers';
import type { BatchAuditItem, BatchAuditRun } from '@/stores/audit/auditTypes';
import { createAuditFixture } from './fixtures/audit';

const item: BatchAuditItem = { id: 'a', url: 'https://example.test', status: 'running' };
const run: BatchAuditRun = { id: 'r', status: 'running', startedAt: 'start', updatedAt: 'update', stopRequested: true };
afterEach(() => vi.useRealTimers());

it('accepts finite numbers only', () => {
  for (const value of [NaN, Infinity, -Infinity, '1', null, undefined]) expect(isFiniteNumber(value)).toBe(false);
  for (const value of [0, -1, 2.5]) expect(isFiniteNumber(value)).toBe(true);
});

it('rejects malformed queue entries while retaining all supported statuses', () => {
  expect(parseBatchQueue(null)).toEqual([]);
  const valid = ['queued', 'running', 'interrupted', 'completed', 'failed'].map((status) => ({ ...item, status }));
  expect(parseBatchQueue([null, false, 1, {}, { url: item.url, status: 'queued' }, { id: 'x', status: 'queued' }, { id: 'x', url: item.url }, { ...item, status: 'unknown' }, ...valid])).toEqual(valid);
});

it('rejects malformed runs and preserves supported metadata', () => {
  for (const value of [null, false, 1, {}, { ...run, id: 1 }, { ...run, startedAt: 1 }, { ...run, updatedAt: 1 }, { ...run, status: undefined }, { ...run, status: 'unknown' }]) expect(parseBatchRun(value)).toBeNull();
  for (const status of ['running', 'interrupted', 'stopped', 'completed'] as const) expect(parseBatchRun({ ...run, status })).toEqual({ ...run, status });
});

it('recovers only running items and creates a missing interrupted run', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T08:00:00Z'));
  const queued: BatchAuditItem = { ...item, id: 'b', status: 'queued' };
  const recovered = recoverInterruptedBatch([item, queued], null);
  expect(recovered.changed).toBe(true);
  expect(recovered.items).toEqual([{ ...item, status: 'interrupted', updatedAt: '2026-10-05T08:00:00.000Z', error: i18n.t('runtimeErrors.audit.batchInterrupted') }, queued]);
  expect(recovered.run).toMatchObject({ status: 'interrupted', startedAt: '2026-10-05T08:00:00.000Z', updatedAt: '2026-10-05T08:00:00.000Z' });
  expect(recoverInterruptedBatch([queued], null)).toEqual({ items: [queued], run: null, changed: false });
  expect(recoverInterruptedBatch([queued], run).run).toEqual({ ...run, status: 'interrupted', updatedAt: '2026-10-05T08:00:00.000Z', stopRequested: false });
});

it('prefers the final hostname and handles missing/invalid/nonhost URLs', () => {
  expect(auditHostname(null)).toBeNull();
  expect(auditHostname(createAuditFixture({ final_url: '', url: 'https://EXAMPLE.test/path' }))).toBe('example.test');
  expect(auditHostname(createAuditFixture({ final_url: 'https://FINAL.test' }))).toBe('final.test');
  expect(auditHostname(createAuditFixture({ final_url: 'invalid' }))).toBeNull();
  expect(auditHostname(createAuditFixture({ final_url: 'file:///tmp/file' }))).toBeNull();
});

it('owns tokens by request kind and latest dispatch', () => {
  const old = beginAuditRequest('direct-fixture');
  const other = beginAuditRequest('other-fixture');
  expect(isLatestAuditRequest('direct-fixture', old)).toBe(true);
  const next = beginAuditRequest('direct-fixture');
  expect(next).not.toBe(old);
  expect(isLatestAuditRequest('direct-fixture', old)).toBe(false);
  expect(isLatestAuditRequest('direct-fixture', next)).toBe(true);
  expect(isLatestAuditRequest('other-fixture', other)).toBe(true);
});

it('formats quota, ordinary and unknown errors without treating them as success', () => {
  expect(formatAuditRuntimeError(new DOMException('full', 'QuotaExceededError'))).toBe(i18n.t('runtimeErrors.persistence.localQuota'));
  expect(formatAuditRuntimeError(new Error('failure'))).toBe('failure');
  expect(formatAuditRuntimeError('unknown')).toBe(i18n.t('runtimeErrors.audit.historySave'));
  expect(formatQueueWakeupError(new Error('scheduler'))).toBe(i18n.t('schedules.schedulerError', { error: 'scheduler' }));
  expect(formatQueueWakeupError(42)).toBe(i18n.t('schedules.schedulerError', { error: '42' }));
});

it('fingerprints absent and measured item/run fields', () => {
  expect(batchSnapshotFingerprint([item], null)).toBe('a:running::0|');
  expect(batchSnapshotFingerprint([{ ...item, updatedAt: 'now', attempts: 2 }], { ...run, activeItemId: 'a' })).toBe('a:running:now:2|r:running:update:a');
});
