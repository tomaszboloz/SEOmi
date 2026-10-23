import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AddTaskButton, OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { readTasks } from '@/services/optimizationTasks/storage';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import i18n from '@/i18n';

const A = 'https://s.test/a';
const tr = (k: string, o: Record<string, unknown> = {}) => i18n.t(`executionCard.tasks.${k}`, o) as string;

describe('task tracker UI', () => {
  beforeEach(() => localStorage.clear());

  it('shows empty state', () => {
    render(<OptimizationTaskTracker projectId="p" pages={[]} scoreFor={() => null} />);
    expect(screen.getByText(tr('empty'))).toBeTruthy();
  });

  it('plan, implement, verify with message and regression alert', () => {
    let added = 0;
    const add = render(<AddTaskButton projectId="p" task={{ kind: 'remove-410', module: 'sfs', url: A, baselineScore: 60 }} onAdded={() => added++} />);
    fireEvent.click(screen.getByRole('button', { name: tr('add') }));
    expect(added).toBe(1);
    expect(screen.getByRole('status').textContent).toBe(tr('added'));
    add.unmount();
    render(<AddTaskButton projectId="p" task={{ kind: 'remove-410', module: 'sfs', url: A, baselineScore: 60 }} />);
    fireEvent.click(screen.getByRole('button', { name: tr('add') }));
    expect(readTasks('p')).toHaveLength(1);

    render(<OptimizationTaskTracker projectId="p" pages={[page({ url: A, final_url: A, http_status: 200 })]} scoreFor={() => 55} />);
    fireEvent.click(screen.getByRole('button', { name: tr('markImplemented') }));
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(tr('verdict.still-200', { status: 200 }));
    expect(alert.textContent).toContain('-5');
    expect(readTasks('p')[0].status).toBe('failed');
  });

  it('shows the verdict without delta when the module has no score', () => {
    render(<AddTaskButton projectId="n" task={{ kind: 'remove-410', module: 'sfs', url: A, baselineScore: null }} />);
    fireEvent.click(screen.getByRole('button', { name: tr('add') }));
    render(<OptimizationTaskTracker projectId="n" pages={[page({ url: A, final_url: A, http_status: 410 })]} scoreFor={() => null} />);
    fireEvent.click(screen.getByRole('button', { name: tr('markImplemented') }));
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
    expect(screen.getByText(tr('verdict.gone-ok'))).toBeTruthy();
  });

  it('shows verified result with positive delta', () => {
    localStorage.clear();
    render(<AddTaskButton projectId="q" task={{ kind: 'remove-410', module: 'sfs', url: A, baselineScore: 10 }} />);
    fireEvent.click(screen.getByRole('button', { name: tr('add') }));
    render(<OptimizationTaskTracker projectId="q" pages={[page({ url: A, final_url: A, http_status: 410 })]} scoreFor={() => 28} />);
    fireEvent.click(screen.getByRole('button', { name: tr('markImplemented') }));
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
    expect(screen.getByText(/\+18/)).toBeTruthy();
  });
});
