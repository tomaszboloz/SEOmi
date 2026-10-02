import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScheduledAuditRow } from '@/components/Domain/scheduledAudits/ScheduledAuditRow';
import { intervalOptions, localDate } from '@/components/Domain/scheduledAudits/scheduleFormat';
import type { ScheduledAudit } from '@/services/auditSchedule';

const translate = (key: string, options?: Record<string, unknown>) => (options ? `${key}:${JSON.stringify(options)}` : key);

describe('scheduled audit row', () => {
  const schedule = {
    id: 's1', url: 'https://example.com/', intervalHours: 12, enabled: true, taskType: 'site-crawl', crawlLimit: 40,
    nextRunAt: '2026-10-02T10:00:00.000Z', status: 'idle', lastError: 'timeout',
    runHistory: [{ startedAt: '2026-10-01T10:00:00.000Z', completedAt: '2026-10-01T10:01:00.000Z', succeeded: false, error: 'boom' }],
  } as unknown as ScheduledAudit;

  it('formats valid dates and marks invalid ones', () => {
    expect(localDate('not a date', 'en')).toBe('—');
    expect(localDate('2026-10-02T10:00:00.000Z', 'en')).toMatch(/2026/);
    expect(intervalOptions.map((option) => option.hours)).toEqual([6, 12, 24, 168]);
  });

  it('renders schedule evidence and routes every action to its callback', () => {
    const onRunNow = vi.fn(); const onToggle = vi.fn(); const onRemove = vi.fn();
    render(<ul><ScheduledAuditRow schedule={schedule} language="en" translate={translate} onRunNow={onRunNow} onToggle={onToggle} onRemove={onRemove} /></ul>);
    expect(screen.getByText(/schedules\.multiPage:\{"count":40\}/)).toBeTruthy();
    expect(screen.getByText(/schedules\.every12Hours/)).toBeTruthy();
    expect(screen.getByText('timeout')).toBeTruthy();
    expect(screen.getByText(/schedules\.failure.*boom/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'schedules.runNowAria' }));
    fireEvent.click(screen.getByRole('button', { name: 'schedules.pauseAria' }));
    fireEvent.click(screen.getByRole('button', { name: 'schedules.removeAria' }));
    expect([onRunNow, onToggle, onRemove].map((callback) => callback.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('disables running now for paused or running schedules', () => {
    const paused = { ...schedule, enabled: false } as ScheduledAudit;
    render(<ul><ScheduledAuditRow schedule={paused} language="en" translate={translate} onRunNow={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} /></ul>);
    expect((screen.getByRole('button', { name: 'schedules.runNowAria' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/schedules\.paused/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'schedules.resumeAria' })).toBeTruthy();
  });
});
