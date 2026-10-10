import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { URLBatchQueueSection } from '@/components/URLBar/urlInput/URLBatchQueueSection';
import { useAuditStore } from '@/stores/auditStore';
import type { BatchAuditStatus, BatchAuditRunStatus } from '@/stores/audit/auditTypes';
import i18n from '@/i18n';

const original = useAuditStore.getState();
const start = vi.fn(async () => {});
const stop = vi.fn();
const clear = vi.fn();
const label = (key: string) => i18n.t(`legacyUi.url.${key}`);
const items = (...statuses: BatchAuditStatus[]) => statuses.map((status, index) => ({
  id: String(index), url: `https://example.test/${index}`, status,
}));
beforeEach(() => {
  vi.clearAllMocks();
  useAuditStore.setState({ batchItems: [], batchRun: null, batchRejectedRows: [],
    batchWakeupError: null, isBatchRunning: false, isBatchStopping: false,
    startBatchAudits: start, stopBatchAudits: stop, clearBatchAudits: clear });
});
afterEach(() => useAuditStore.setState(original));

describe('CSV queue public controls', () => {
  it('renders nothing for an empty queue', () => {
    expect(render(<URLBatchQueueSection />).container.childElementCount).toBe(0);
  });
  it('runs fresh queued items and clears an idle queue', () => {
    useAuditStore.setState({ batchItems: items('queued') });
    render(<URLBatchQueueSection />);
    fireEvent.click(screen.getByRole('button', { name: label('run') }));
    expect(start).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTitle(label('clearQueue')));
    expect(clear).toHaveBeenCalledOnce();
  });
  it.each(['completed', 'failed', 'interrupted'] as const)('offers resume for %s items', (status) => {
    useAuditStore.setState({ batchItems: items(status) });
    render(<URLBatchQueueSection />);
    const resume = screen.getByRole('button', { name: label('resume') });
    expect((resume as HTMLButtonElement).disabled).toBe(status === 'completed');
    fireEvent.click(resume);
    expect(start).toHaveBeenCalledTimes(status === 'completed' ? 0 : 1);
  });
  it('counts every state and explains rejected and interrupted rows', () => {
    useAuditStore.setState({ batchItems: items('queued', 'running', 'interrupted', 'completed', 'failed'),
      batchRejectedRows: ['invalid'], batchWakeupError: 'Wakeup failed' });
    render(<URLBatchQueueSection />);
    expect(screen.getByText(i18n.t('legacyUi.url.queue', { completed: 1, pending: 3, failed: 1,
      interrupted: i18n.t('legacyUi.url.interrupted', { count: 1 }),
      rejected: i18n.t('legacyUi.url.rejected', { count: 1 }) }), { exact: false })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Wakeup failed');
  });
  it.each(['running', 'interrupted', 'stopped', 'completed'] as BatchAuditRunStatus[])(
    'displays the %s run status without an absent timestamp', (status) => {
      useAuditStore.setState({ batchItems: items('queued'), batchRun: {
        id: 'run', status, startedAt: '', updatedAt: '',
      } });
      render(<URLBatchQueueSection />);
      const key = `run${status[0].toUpperCase()}${status.slice(1)}`;
      expect(screen.getByText(`(${label(key)})`)).toBeTruthy();
    },
  );
  it('shows the saved update timestamp', () => {
    const date = '2026-01-01T12:00:00Z';
    useAuditStore.setState({ batchItems: items('queued'), batchRun: {
      id: 'run', status: 'running', startedAt: date, updatedAt: date,
    } });
    render(<URLBatchQueueSection />);
    expect(screen.getByText(new RegExp(label('runRunning'))).textContent).toContain('2026');
  });
  it.each([false, true])('allows stopping only before cancellation starts (%s)', (stopping) => {
    useAuditStore.setState({ batchItems: items('running'), isBatchRunning: true, isBatchStopping: stopping });
    render(<URLBatchQueueSection />);
    const button = screen.getByRole('button', { name: label('stop') });
    expect((button as HTMLButtonElement).disabled).toBe(stopping);
    expect((screen.getByTitle(label('clearQueue')) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(stop).toHaveBeenCalledTimes(stopping ? 0 : 1);
    fireEvent.click(screen.getByTitle(label('clearQueue')));
    expect(clear).not.toHaveBeenCalled();
    if (stopping) expect(screen.getByText(label('cancelling'), { exact: false })).toBeTruthy();
  });
});
