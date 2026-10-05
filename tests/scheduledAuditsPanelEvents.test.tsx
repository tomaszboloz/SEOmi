import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { syncMock, removeMock } = vi.hoisted(() => ({ syncMock: vi.fn(), removeMock: vi.fn() }));
vi.mock('@/services/scheduleWakeup', () => ({ syncAuditWakeup: syncMock, removeAuditWakeup: removeMock }));

import { ScheduledAuditsPanel } from '@/components/Domain/ScheduledAuditsPanel';
import { AUDIT_SCHEDULES_UPDATED_EVENT, addScheduledAudit } from '@/services/auditSchedule';
import i18n from '@/i18n';

const open = () => fireEvent.click(screen.getByText(i18n.t('schedules.title')));
const emit = (detail?: { projectId?: string }) => act(() => { window.dispatchEvent(new CustomEvent(AUDIT_SCHEDULES_UPDATED_EVENT, { detail })); });

describe('ScheduledAuditsPanel external updates', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    syncMock.mockReset().mockResolvedValue(undefined);
    removeMock.mockReset().mockResolvedValue(undefined);
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('reloads schedules only for update events of its own project', () => {
    render(<ScheduledAuditsPanel projectId="ev1" />);
    open();
    expect(screen.queryByText('https://e.test/')).toBeNull();
    addScheduledAudit('ev1', 'https://e.test/', 24, Date.now());
    emit({ projectId: 'other' });
    expect(screen.queryByText('https://e.test/')).toBeNull();
    emit();
    expect(screen.queryByText('https://e.test/')).toBeNull();
    emit({ projectId: 'ev1' });
    expect(screen.getByText('https://e.test/')).toBeTruthy();
  });

  it('stops listening after unmount', () => {
    const view = render(<ScheduledAuditsPanel projectId="ev2" />);
    view.unmount();
    addScheduledAudit('ev2', 'https://e2.test/', 24, Date.now());
    emit({ projectId: 'ev2' });
    expect(screen.queryByText('https://e2.test/')).toBeNull();
  });

  it('ignores a late wake-up removal failure after the project changed', async () => {
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    let reject: (e: unknown) => void = () => undefined;
    removeMock.mockImplementation(() => new Promise((_, r) => { reject = r; }));
    addScheduledAudit('ev3', 'https://e3.test/', 24, Date.now());
    const view = render(<ScheduledAuditsPanel projectId="ev3" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.removeAria') }));
    view.rerender(<ScheduledAuditsPanel projectId="ev4" />);
    await act(async () => { reject(new Error('late')); });
    expect(screen.queryByRole('alert')).toBeNull();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });
});
