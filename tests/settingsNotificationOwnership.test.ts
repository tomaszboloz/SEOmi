import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { settingsHandlersHook } from './fixtures/settingsHandlersHook';
import { useProjectStore } from '@/stores/projectStore';
import { areAuditNotificationsEnabled } from '@/services/desktopNotifications';
import { deferred } from './fixtures/gscSliceDirect';
import i18n from '@/i18n';

vi.mock('@tauri-apps/plugin-notification', () => ({ isPermissionGranted: vi.fn(), requestPermission: vi.fn(), sendNotification: vi.fn() }));
beforeEach(() => {
  localStorage.clear(); vi.mocked(isPermissionGranted).mockReset().mockResolvedValue(false);
  vi.mocked(requestPermission).mockReset().mockResolvedValue('granted');
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__; });

it('does not replace explicit opt-out status after an earlier permission request finishes', async () => {
  const f = settingsHandlersHook(); const native = deferred<'granted'>();
  vi.mocked(requestPermission).mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.handleAuditNotificationsChange(true); });
  await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledOnce());
  await act(async () => f.result.current.handleAuditNotificationsChange(false));
  await act(async () => { native.resolve('granted'); await pending; });
  expect(f.result.current.auditNotificationsEnabled).toBe(false);
  expect(f.result.current.notificationStatus).toBeNull();
  expect(areAuditNotificationsEnabled('one')).toBe(false);
});

it('keeps the new project UI separate from an originating project permission result', async () => {
  const f = settingsHandlersHook(); const native = deferred<'granted'>();
  vi.mocked(requestPermission).mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.handleAuditNotificationsChange(true); });
  await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledOnce());
  act(() => useProjectStore.setState({ activeProjectId: 'two' }));
  await act(async () => { native.resolve('granted'); await pending; });
  expect(f.result.current.auditNotificationsEnabled).toBe(false);
  expect(f.result.current.notificationStatus).toBeNull();
  expect(areAuditNotificationsEnabled('two')).toBe(false);
  expect(areAuditNotificationsEnabled('one')).toBe(true);
});

it('does not replace a newer enabled state with an older denied request', async () => {
  const f = settingsHandlersHook(); const native = deferred<'denied'>();
  vi.mocked(requestPermission).mockReturnValueOnce(native.promise);
  let pending!: Promise<void>;
  act(() => { pending = f.result.current.handleAuditNotificationsChange(true); });
  await vi.waitFor(() => expect(requestPermission).toHaveBeenCalledOnce());
  vi.mocked(isPermissionGranted).mockResolvedValueOnce(true);
  await act(async () => f.result.current.handleAuditNotificationsChange(true));
  await act(async () => { native.resolve('denied'); await pending; });
  expect(f.result.current.auditNotificationsEnabled).toBe(true);
  expect(f.result.current.notificationStatus).toBe(i18n.t('settings.notificationsEnabled'));
  expect(areAuditNotificationsEnabled('one')).toBe(true);
});

it.each(['granted', 'denied'] as const)('persists and reports current permission %s', async (permission) => {
  const f = settingsHandlersHook(); vi.mocked(requestPermission).mockResolvedValueOnce(permission);
  await act(async () => f.result.current.handleAuditNotificationsChange(true));
  expect(f.result.current.auditNotificationsEnabled).toBe(permission === 'granted');
  expect(f.result.current.notificationStatus).toBe(i18n.t(permission === 'granted' ? 'settings.notificationsEnabled' : 'settings.notificationsDenied'));
  expect(areAuditNotificationsEnabled('one')).toBe(permission === 'granted');
});

it('removes preferences and reminder markers on explicit opt-out without requesting permission', async () => {
  const f = settingsHandlersHook();
  localStorage.setItem('seomi_project_one_desktop_notifications_v1', 'true');
  localStorage.setItem('seomi_project_one_audit_reminders_v1', '{}');
  await act(async () => f.result.current.handleAuditNotificationsChange(false));
  expect(areAuditNotificationsEnabled('one')).toBe(false);
  expect(localStorage.getItem('seomi_project_one_audit_reminders_v1')).toBeNull();
  expect(f.result.current.notificationStatus).toBeNull();
  expect(requestPermission).not.toHaveBeenCalled();
});

it('skips notification changes without an active project', async () => {
  const f = settingsHandlersHook(); act(() => useProjectStore.setState({ activeProjectId: null }));
  await act(async () => f.result.current.handleAuditNotificationsChange(true));
  expect(isPermissionGranted).not.toHaveBeenCalled();
  expect(f.result.current.auditNotificationsEnabled).toBe(false);
  expect(f.result.current.notificationStatus).toBeNull();
});
