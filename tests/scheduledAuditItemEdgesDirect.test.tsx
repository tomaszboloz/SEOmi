import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledAuditItem } from '@/components/Domain/scheduledAudits/ScheduledAuditItem';
import { localDate } from '@/components/Domain/scheduledAudits/scheduledAuditHelpers';
import type { ScheduledAudit } from '@/services/auditSchedule';
import i18n from '@/i18n';

const date = '2026-01-01T12:00:00Z';
const fixture = (patch: Partial<ScheduledAudit> = {}): ScheduledAudit => ({
  id: 'schedule', url: 'https://example.test/', intervalHours: 24, enabled: true,
  status: 'scheduled', createdAt: date, nextRunAt: date, ...patch,
});
const show = (schedule: ScheduledAudit) => {
  const actions = { onRunNow: vi.fn(), onToggleEnabled: vi.fn(), onRemove: vi.fn() };
  render(<ul><ScheduledAuditItem schedule={schedule} language="en" {...actions} t={i18n.t} /></ul>);
  return actions;
};

describe('scheduled audit item legacy defaults and execution evidence', () => {
  it('uses the default crawl limit and daily label for an unknown legacy interval', () => {
    show(fixture({ taskType: 'site-crawl', intervalHours: 999 as ScheduledAudit['intervalHours'] }));
    expect(screen.getByText(i18n.t('schedules.multiPage', { count: 25 }), { exact: false })).toBeTruthy();
    expect(screen.getByText(i18n.t('schedules.daily'), { exact: false })).toBeTruthy();
  });
  it('renders a task error and only the newest five history items in reverse order', () => {
    const history = Array.from({ length: 6 }, (_, index) => ({
      startedAt: `2026-01-0${index + 1}T10:00:00Z`, completedAt: `2026-01-0${index + 1}T12:00:00Z`,
      succeeded: index % 2 === 0, error: index % 2 === 0 ? undefined : `failure-${index}`,
    }));
    show(fixture({ lastError: 'Task failure', lastRunAt: date, runHistory: history }));
    expect(screen.getByText('Task failure')).toBeTruthy();
    expect(screen.getByText(i18n.t('schedules.last', { date: localDate(date, 'en') }), { exact: false })).toBeTruthy();
    const details = screen.getByText(i18n.t('schedules.history', { count: 6 })).closest('details')!;
    const rows = Array.from(details.querySelectorAll('li'));
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toContain('failure-5');
    expect(rows[0].textContent).toContain(i18n.t('schedules.failure'));
    expect(rows[0].className).toContain('text-rose-300');
    expect(rows[1].textContent).toContain(i18n.t('schedules.success'));
    expect(rows[1].className).toContain('text-emerald-300');
    expect(rows[4].textContent).toContain('failure-1');
  });
  it.each([false, true])('disables run for a paused or currently running task (%s)', (running) => {
    const enabled = running;
    const actions = show(fixture({ enabled, status: running ? 'running' : 'paused' }));
    const button = screen.getByRole('button', { name: i18n.t('schedules.runNowAria') });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(actions.onRunNow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: i18n.t(enabled ? 'schedules.pauseAria' : 'schedules.resumeAria') }));
    expect(actions.onToggleEnabled).toHaveBeenCalledWith('schedule', enabled);
  });
});
