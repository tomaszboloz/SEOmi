import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { syncMock, removeMock, addMock } = vi.hoisted(() => ({ syncMock: vi.fn(), removeMock: vi.fn(), addMock: vi.fn() }));
vi.mock('@/services/scheduleWakeup', () => ({ syncAuditWakeup: syncMock, removeAuditWakeup: removeMock }));
vi.mock('@/services/auditSchedule', async (orig) => {
  const actual = await orig<typeof import('@/services/auditSchedule')>();
  addMock.mockImplementation(actual.addScheduledAudit);
  return { ...actual, addScheduledAudit: addMock };
});

import { ScheduledAuditsPanel } from '@/components/Domain/ScheduledAuditsPanel';
import { loadScheduledAudits } from '@/services/auditSchedule';
import i18n from '@/i18n';

const open = () => fireEvent.click(screen.getByText(i18n.t('schedules.title')));
const wrapped = (error: string) => i18n.t('schedules.schedulerError', { error });
const add = () => fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.add') }));
const tauri = () => Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });

describe('ScheduledAuditsPanel wake-up and error handling', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    localStorage.clear();
    syncMock.mockReset().mockResolvedValue(undefined);
    removeMock.mockReset().mockResolvedValue(undefined);
    tauri();
  });
  afterEach(() => { Reflect.deleteProperty(window, '__TAURI_INTERNALS__'); });

  it('shows the Error message when the OS wake-up registration fails and clears it on success', async () => {
    syncMock.mockRejectedValueOnce(new Error('launchd refused'));
    render(<ScheduledAuditsPanel projectId="pw1" initialUrl="https://example.com/" />);
    open(); add();
    expect((await screen.findByRole('alert')).textContent).toBe(wrapped('launchd refused'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.pauseAria') }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(syncMock).toHaveBeenCalledTimes(2);
  });

  it('formats a non-Error wake-up rejection and handles remove failures', async () => {
    syncMock.mockRejectedValueOnce('plain failure');
    render(<ScheduledAuditsPanel projectId="pw2" initialUrl="https://example.com/" />);
    open(); add();
    expect((await screen.findByRole('alert')).textContent).toBe(wrapped(wrapped('plain failure')));
    removeMock.mockRejectedValueOnce('rm failed');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.removeAria') }));
    await waitFor(() => expect(removeMock).toHaveBeenCalledWith('pw2', expect.any(String)));
    expect((await screen.findByRole('alert')).textContent).toBe(wrapped(wrapped('rm failed')));
    expect(loadScheduledAudits('pw2')).toEqual([]);
  });

  it('shows the Error message from a failed wake-up removal', async () => {
    render(<ScheduledAuditsPanel projectId="pw3" initialUrl="https://example.com/" />);
    open(); add();
    removeMock.mockRejectedValueOnce(new Error('rm boom'));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.removeAria') }));
    expect((await screen.findByRole('alert')).textContent).toBe(wrapped('rm boom'));
  });

  it('does not report a late wake-up failure after the project changed', async () => {
    let reject: (e: unknown) => void = () => undefined;
    syncMock.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
    const view = render(<ScheduledAuditsPanel projectId="pw4" initialUrl="https://example.com/" />);
    open(); add();
    view.rerender(<ScheduledAuditsPanel projectId="pw5" initialUrl="https://example.com/" />);
    await act(async () => { reject(new Error('late')); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not touch the OS scheduler outside the desktop app', () => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    render(<ScheduledAuditsPanel projectId="pw6" initialUrl="https://example.com/" />);
    open();
    expect(screen.getByRole('status').textContent).toBe(i18n.t('schedules.desktopOnly'));
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('reports save errors for Error and non-Error failures', async () => {
    addMock.mockImplementationOnce(() => { throw new Error('invalid url'); });
    render(<ScheduledAuditsPanel projectId="pw7" initialUrl="https://example.com/" />);
    open(); add();
    expect((await screen.findByRole('alert')).textContent).toBe('invalid url');
    addMock.mockImplementationOnce(() => { throw 'weird'; });
    add();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(i18n.t('schedules.saveError')));
    expect(loadScheduledAudits('pw7')).toEqual([]);
  });

  it('runs a schedule now and syncs its wake-up', async () => {
    render(<ScheduledAuditsPanel projectId="pw8" initialUrl="https://example.com/" />);
    open(); add();
    syncMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.runNowAria') }));
    await waitFor(() => expect(syncMock).toHaveBeenCalledWith('pw8', expect.objectContaining({ id: loadScheduledAudits('pw8')[0].id })));
  });

  it('skips wake-up calls for stored schedules outside the desktop app', () => {
    const view = render(<ScheduledAuditsPanel projectId="pw9" initialUrl="https://example.com/" />);
    open(); add();
    view.unmount();
    syncMock.mockClear();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
    render(<ScheduledAuditsPanel projectId="pw9" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.pauseAria') }));
    expect(loadScheduledAudits('pw9')[0].enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.removeAria') }));
    expect(loadScheduledAudits('pw9')).toEqual([]);
    expect(syncMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('ignores late wake-up results after the project changed', async () => {
    const resolvers: Array<() => void> = [];
    syncMock.mockImplementation(() => new Promise<void>((r) => { resolvers.push(r); }));
    removeMock.mockImplementation(() => new Promise<void>((r) => { resolvers.push(r); }));
    const view = render(<ScheduledAuditsPanel projectId="pw10" initialUrl="https://example.com/" />);
    open(); add();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('schedules.removeAria') }));
    view.rerender(<ScheduledAuditsPanel projectId="pw11" initialUrl="https://example.com/" />);
    await act(async () => { resolvers.forEach((r) => r()); });
    expect(resolvers).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('falls back to the Polish locale label when no language is active', async () => {
    const original = Object.getOwnPropertyDescriptor(i18n, 'language');
    Object.defineProperty(i18n, 'language', { value: '', configurable: true });
    try {
      render(<ScheduledAuditsPanel projectId="pw12" initialUrl="https://example.com/" />);
      open(); add();
      expect(loadScheduledAudits('pw12')).toHaveLength(1);
    } finally {
      if (original) Object.defineProperty(i18n, 'language', original);
    }
  });
});
