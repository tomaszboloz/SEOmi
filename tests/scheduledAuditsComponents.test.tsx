import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { intervalOptions, localDate } from '@/components/Domain/scheduledAudits/scheduledAuditHelpers';
import { ScheduledAuditForm } from '@/components/Domain/scheduledAudits/ScheduledAuditForm';
import { ScheduledAuditsList } from '@/components/Domain/scheduledAudits/ScheduledAuditsList';
import type { ScheduledAudit } from '@/services/auditSchedule';

const mockT = (key: string, options?: Record<string, unknown>) => {
  if (options?.count !== undefined) return `${key}:${options.count}`;
  if (options?.date !== undefined) return `${key}:${options.date}`;
  return key;
};

describe('ScheduledAudits submodules', () => {
  it('verifies intervalOptions and localDate helper', () => {
    expect(intervalOptions.map((o) => o.hours)).toEqual([6, 12, 24, 168]);
    expect(localDate('invalid-date', 'en')).toBe('—');
    expect(localDate('2026-09-01T12:00:00Z', 'en')).not.toBe('—');
  });

  it('renders ScheduledAuditForm and handles input changes and submit', () => {
    const setUrl = vi.fn();
    const setTaskType = vi.fn();
    const setIntervalHours = vi.fn();
    const setScheduledCrawlLimit = vi.fn();
    const onSubmit = vi.fn((e) => e.preventDefault());

    const { rerender } = render(
      <ScheduledAuditForm
        url="https://example.com"
        setUrl={setUrl}
        taskType="page-audit"
        setTaskType={setTaskType}
        intervalHours={24}
        setIntervalHours={setIntervalHours}
        scheduledCrawlLimit={25}
        setScheduledCrawlLimit={setScheduledCrawlLimit}
        isTauri={true}
        schedulesCount={0}
        onSubmit={onSubmit}
        t={mockT}
      />
    );

    const urlInput = screen.getByRole('textbox');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/blog' } });
    expect(setUrl).toHaveBeenCalledWith('https://example.com/blog');

    rerender(
      <ScheduledAuditForm
        url="https://example.com"
        setUrl={setUrl}
        taskType="site-crawl"
        setTaskType={setTaskType}
        intervalHours={24}
        setIntervalHours={setIntervalHours}
        scheduledCrawlLimit={25}
        setScheduledCrawlLimit={setScheduledCrawlLimit}
        isTauri={true}
        schedulesCount={0}
        onSubmit={onSubmit}
        t={mockT}
      />
    );

    const crawlLimitInput = screen.getByRole('spinbutton', { name: 'schedules.crawlLimit' });
    fireEvent.change(crawlLimitInput, { target: { value: '50' } });
    expect(setScheduledCrawlLimit).toHaveBeenCalledWith(50);

    const intervalSelect = document.getElementById('scheduled-audit-interval')!;
    fireEvent.change(intervalSelect, { target: { value: '168' } });
    expect(setIntervalHours).toHaveBeenCalledWith(168);

    fireEvent.submit(urlInput.closest('form')!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it('renders ScheduledAuditsList empty message and item callbacks', () => {
    const onRunNow = vi.fn();
    const onToggleEnabled = vi.fn();
    const onRemove = vi.fn();

    const { rerender } = render(
      <ScheduledAuditsList
        schedules={[]}
        language="en"
        onRunNow={onRunNow}
        onToggleEnabled={onToggleEnabled}
        onRemove={onRemove}
        t={mockT}
      />
    );
    expect(screen.getByText('schedules.empty')).toBeDefined();

    const dummySchedule: ScheduledAudit = {
      id: 'sched-1',
      url: 'https://example.com',
      intervalHours: 24,
      nextRunAt: '2026-09-02T12:00:00Z',
      createdAt: '2026-09-01T00:00:00Z',
      status: 'scheduled',
      enabled: true,
      taskType: 'site-crawl',
      crawlLimit: 50,
      runHistory: [
        { startedAt: '2026-09-01T10:00:00Z', completedAt: '2026-09-01T10:05:00Z', succeeded: true },
      ],
    };

    rerender(
      <ScheduledAuditsList
        schedules={[dummySchedule]}
        language="en"
        onRunNow={onRunNow}
        onToggleEnabled={onToggleEnabled}
        onRemove={onRemove}
        t={mockT}
      />
    );

    expect(screen.getByText('https://example.com')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'schedules.runNowAria' }));
    expect(onRunNow).toHaveBeenCalledWith('sched-1');

    fireEvent.click(screen.getByRole('button', { name: 'schedules.pauseAria' }));
    expect(onToggleEnabled).toHaveBeenCalledWith('sched-1', true);

    fireEvent.click(screen.getByRole('button', { name: 'schedules.removeAria' }));
    expect(onRemove).toHaveBeenCalledWith('sched-1');
  });
});
