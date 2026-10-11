import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/scheduleWakeup', () => ({
  syncAuditWakeup: vi.fn().mockResolvedValue(undefined),
  removeAuditWakeup: vi.fn().mockResolvedValue(undefined),
}));

import { ScheduledAuditsPanel } from '@/components/Domain/ScheduledAuditsPanel';
import { claimDueScheduledAudit, finishScheduledAudit, loadScheduledAudits, type ScheduledAudit } from '@/services/auditSchedule';
import { syncAuditWakeup } from '@/services/scheduleWakeup';
import i18n from '@/i18n';

describe('ScheduledAuditsPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
    localStorage.clear();
    vi.mocked(syncAuditWakeup).mockClear();
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
  });

  it('creates a project-local schedule and updates its live status', async () => {
    render(<ScheduledAuditsPanel projectId="project-ui" initialUrl="https://example.com/page" />);
    fireEvent.click(screen.getByText('Harmonogram audytów projektu'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
      await Promise.resolve();
    });

    const [schedule] = loadScheduledAudits('project-ui');
    expect(schedule).toBeDefined();
    expect(schedule.url).toBe('https://example.com/page');
    expect(screen.getByText('https://example.com/page')).toBeTruthy();
    expect(loadScheduledAudits('other-project')).toEqual([]);

    const claimed: { current: ScheduledAudit | null } = { current: null };
    act(() => { claimed.current = claimDueScheduledAudit('project-ui', Date.parse(schedule.nextRunAt)); });
    expect(claimed.current?.status).toBe('running');
    await waitFor(() => expect(screen.getByText(/· trwa/)).toBeTruthy());
    act(() => { finishScheduledAudit('project-ui', schedule.id, true, undefined, Date.parse(schedule.nextRunAt) + 1000); });
    await waitFor(() => expect(screen.getByText(/· ostatni:/)).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wstrzymaj harmonogram' }));
      await Promise.resolve();
    });
    expect(loadScheduledAudits('project-ui')[0].enabled).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Usuń harmonogram' }));
      await Promise.resolve();
    });
    expect(loadScheduledAudits('project-ui')).toEqual([]);
  });

  it('creates a persisted multi-page crawl schedule from the current crawl configuration', async () => {
    render(
      <ScheduledAuditsPanel
        projectId="project-crawl"
        initialUrl="https://example.com/"
        crawlLimit={40}
        crawlConfig={{ includePatterns: ['/docs/'], maxDepth: 2, respectRobots: true } as never}
      />,
    );
    fireEvent.click(screen.getByText('Harmonogram audytów projektu'));
    fireEvent.change(screen.getByLabelText('Typ zaplanowanego audytu'), { target: { value: 'site-crawl' } });
    expect((screen.getByLabelText('Limit URL zaplanowanego crawla') as HTMLInputElement).value).toBe('40');
    fireEvent.change(screen.getByLabelText('Limit URL zaplanowanego crawla'), { target: { value: '60' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
      await Promise.resolve();
    });

    expect(loadScheduledAudits('project-crawl')[0]).toMatchObject({
      taskType: 'site-crawl',
      crawlLimit: 60,
      crawlConfig: { includePatterns: ['/docs/'], maxDepth: 2 },
    });
    expect(screen.getByText(/Multi-page crawl · 60 URL/)).toBeTruthy();
  });

  it('exposes a manual run action that makes the schedule due', async () => {
    render(<ScheduledAuditsPanel projectId="project-now" initialUrl="https://example.com/page" />);
    fireEvent.click(screen.getByText('Harmonogram audytów projektu'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));
      await Promise.resolve();
    });
    const schedule = loadScheduledAudits('project-now')[0];
    vi.mocked(syncAuditWakeup).mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Uruchom harmonogram teraz' }));
      await Promise.resolve();
    });

    expect(loadScheduledAudits('project-now')[0].nextRunAt).toBeTruthy();
    expect(Date.parse(loadScheduledAudits('project-now')[0].nextRunAt)).toBeLessThanOrEqual(Date.now());
    expect(syncAuditWakeup).toHaveBeenLastCalledWith(
      'project-now',
      expect.objectContaining({ id: schedule.id, nextRunAt: loadScheduledAudits('project-now')[0].nextRunAt }),
    );
    let claimedId: string | undefined;
    act(() => {
      claimedId = claimDueScheduledAudit('project-now', Date.now())?.id;
    });
    expect(claimedId).toBe(schedule.id);
  });

  it('does not show a stale scheduler error after switching projects', async () => {
    let rejectWakeup!: (reason: Error) => void;
    vi.mocked(syncAuditWakeup).mockImplementationOnce(() => new Promise((_, reject) => { rejectWakeup = reject; }));
    const view = render(<ScheduledAuditsPanel projectId="project-scheduler-old" initialUrl="https://old.example/" />);
    fireEvent.click(screen.getByText('Harmonogram audytów projektu'));
    fireEvent.click(screen.getByRole('button', { name: 'Dodaj' }));

    view.rerender(<ScheduledAuditsPanel projectId="project-scheduler-new" initialUrl="https://new.example/" />);
    await act(async () => {
      rejectWakeup(new Error('old project scheduler failed'));
      await Promise.resolve();
    });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
