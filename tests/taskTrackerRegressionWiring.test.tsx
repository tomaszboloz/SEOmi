import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const monitor = vi.hoisted(() => vi.fn());
vi.mock('@/services/monitoringAlerts', () => ({ monitorTaskRegression: monitor }));

import '@/i18n';
import { AddTaskButton, OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import i18n from '@/i18n';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const A = 'https://s.test/a';
const tr = (key: string) => i18n.t(`executionCard.tasks.${key}`) as string;

beforeEach(() => { localStorage.clear(); monitor.mockReset(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

it('sends newly verified task deltas to the alert policy and survives a failing delivery (#106)', async () => {
  monitor.mockRejectedValueOnce(new Error('offline'));
  render(<AddTaskButton projectId="p" task={{ kind: 'remove-410', module: 'sfs', url: A, baselineScore: 60 }} />);
  fireEvent.click(screen.getByRole('button', { name: tr('add') }));
  render(<OptimizationTaskTracker projectId="p" pages={[page({ url: A, final_url: A, http_status: 200 })]} scoreFor={() => 55} crawlStartedAt="2026-10-26T10:00:00Z" />);
  fireEvent.click(screen.getByRole('button', { name: tr('markImplemented') }));
  fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
  await vi.waitFor(() => expect(monitor).toHaveBeenCalled());
  expect(monitor).toHaveBeenCalledWith('p', [expect.objectContaining({ module: 'sfs', url: A, delta: -5, status: 'failed' })], expect.any(String));
});
