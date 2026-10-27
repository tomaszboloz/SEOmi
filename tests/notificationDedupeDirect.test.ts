import { beforeEach, describe, expect, it } from 'vitest';
import {
  completionNotificationFingerprint,
  reserveCompletionNotification,
} from '@/services/desktopNotifications/dedupe';

beforeEach(() => {
  localStorage.clear();
});

describe('desktop notifications dedupe direct assertions', () => {
  it('completionNotificationFingerprint builds URL-encoded pipe-separated keys', () => {
    expect(completionNotificationFingerprint('project-1', 'run-123', 'audit'))
      .toBe('project-1|run-123|audit');
    expect(completionNotificationFingerprint('proj/a', 'run-1', 'crawl'))
      .toBeNull(); // invalid project ID
    expect(completionNotificationFingerprint('project-1', '   ', 'batch'))
      .toBeNull(); // empty runId
  });

  it('reserveCompletionNotification reserves slot and returns reservation object', () => {
    const reservation = reserveCompletionNotification('project-1', 'run-1', 'audit');
    expect(reservation).not.toBeNull();
    expect(reservation?.duplicate).toBe(false);
    expect(reservation?.fingerprint).toBe('project-1|run-1|audit');

    // Second call for same fingerprint while pending marks duplicate
    const second = reserveCompletionNotification('project-1', 'run-1', 'audit');
    expect(second?.duplicate).toBe(true);
    expect(second?.finish(true)).toBe(false);

    // Finishing first as sent: true records to storage
    const stored = reservation?.finish(true);
    expect(stored).toBe(true);

    // Call after stored marks duplicate
    const third = reserveCompletionNotification('project-1', 'run-1', 'audit');
    expect(third?.duplicate).toBe(true);
    expect(third?.finish(false)).toBe(false);
  });

  it('reserveCompletionNotification handles invalid inputs gracefully', () => {
    expect(reserveCompletionNotification('', 'run-1', 'audit')).toBeNull();
    expect(reserveCompletionNotification('invalid/id', 'run-1', 'audit')).toBeNull();
    expect(reserveCompletionNotification('valid-id', '', 'audit')).toBeNull();
  });

  it('finish(false) aborts reservation without writing', () => {
    const res = reserveCompletionNotification('project-1', 'run-x', 'crawl');
    expect(res?.finish(false)).toBe(false);
    // After aborting, slot is freed
    const retry = reserveCompletionNotification('project-1', 'run-x', 'crawl');
    expect(retry?.duplicate).toBe(false);
  });

  it('handles corrupt and non-array storage gracefully', () => {
    localStorage.setItem('seomi_project_project-err_completion_notifications_v1', 'bad-json');
    const res1 = reserveCompletionNotification('project-err', 'run-1', 'audit');
    expect(res1?.storageError).toBe(true);

    localStorage.setItem('seomi_project_project-obj_completion_notifications_v1', '{"not":"array"}');
    const res2 = reserveCompletionNotification('project-obj', 'run-1', 'audit');
    expect(res2?.storageError).toBe(true);

    localStorage.setItem(
      'seomi_project_project-partial_completion_notifications_v1',
      JSON.stringify([{ invalid: 123 }, { fingerprint: 'project-partial|run-old|audit', sentAt: '2026-01-01' }]),
    );
    const res3 = reserveCompletionNotification('project-partial', 'run-new', 'audit');
    expect(res3?.storageError).toBe(true);
  });

  it('finish handles already-persisted fingerprint idempotently', () => {
    const res = reserveCompletionNotification('project-1', 'run-idem', 'audit');
    // Pre-populate storage before calling finish
    localStorage.setItem(
      'seomi_project_project-1_completion_notifications_v1',
      JSON.stringify([{ fingerprint: 'project-1|run-idem|audit', sentAt: '2026-01-01' }]),
    );
    expect(res?.finish(true)).toBe(true);
  });

  it('finish returns false if storage read fails on finish', () => {
    const res = reserveCompletionNotification('project-1', 'run-fail', 'audit');
    localStorage.setItem('seomi_project_project-1_completion_notifications_v1', 'corrupted');
    expect(res?.finish(true)).toBe(false);
  });

  it('handles undefined localStorage gracefully', () => {
    const orig = window.localStorage;
    Object.defineProperty(window, 'localStorage', { value: undefined, configurable: true, writable: true });
    try {
      const res = reserveCompletionNotification('project-1', 'run-nolocal', 'audit');
      expect(res?.storageError).toBe(true);
    } finally {
      Object.defineProperty(window, 'localStorage', { value: orig, configurable: true, writable: true });
    }
  });
});
