import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { ContextualLinkInjectorPanel } from '@/components/Charts/ContextualLinkInjectorPanel';
import { OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { editTask } from '@/services/optimizationTasks/edit';
import { planTask, readTasks, tasksKey, writeTasks } from '@/services/optimizationTasks/storage';
import type { LinkInjection } from '@/services/linkInjector';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const A = 'https://s.test/a';
const B = 'https://s.test/b';
const tr = (key: string, options: Record<string, unknown> = {}) => i18n.t(`executionCard.tasks.${key}`, options) as string;

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('expected task effect (#134)', () => {
  it('keeps a task with a damaged estimate but drops the estimate', () => {
    localStorage.setItem(tasksKey('p'), JSON.stringify([
      { id: 't1', kind: 'add-link', module: 'sprs', status: 'planned', url: A, baselineScore: null, priority: 'medium', createdAt: '2026-10-01', expectedDelta: 'x' },
      { id: 't2', kind: 'add-link', module: 'sprs', status: 'planned', url: B, baselineScore: null, priority: 'medium', createdAt: '2026-10-01', expectedDelta: 2.5 },
    ]));
    const [damaged, valid] = readTasks('p');
    expect(damaged).not.toHaveProperty('expectedDelta');
    expect(valid.expectedDelta).toBe(2.5);
  });

  it('edits the estimate with rounding, bounds and clearing', () => {
    const [task] = planTask([], { kind: 'add-link', module: 'sprs', url: A, baselineScore: null });
    const one = (edit: Parameters<typeof editTask>[2], from = [task]) => editTask(from, task.id, edit)[0];
    expect(one({ expectedDelta: 3.456 }).expectedDelta).toBe(3.5);
    expect(one({ expectedDelta: 101 })).not.toHaveProperty('expectedDelta');
    expect(one({ expectedDelta: Number.NaN })).not.toHaveProperty('expectedDelta');
    expect(one({ expectedDelta: null }, [{ ...task, expectedDelta: 4 }])).not.toHaveProperty('expectedDelta');
    expect(one({}, [{ ...task, expectedDelta: 4 }]).expectedDelta).toBe(4);
  });

  it('edits the estimate in the tracker and compares it with the measured change', () => {
    writeTasks('p', [{ ...planTask([], { kind: 'remove-410', module: 'sfs', url: A, baselineScore: 60 })[0], status: 'implemented', implementedAt: '2026-10-01T00:00:00Z' }]);
    render(<OptimizationTaskTracker projectId="p" pages={[page({ url: A, final_url: A, http_status: 410 })]} scoreFor={() => 63} crawlStartedAt="2026-10-02T00:00:00Z" />);
    const input = screen.getByLabelText(tr('expectedDelta'));
    fireEvent.blur(input, { target: { value: '5' } });
    expect(readTasks('p')[0].expectedDelta).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
    expect(screen.getByRole('status').textContent).toContain(tr('expectedVsMeasured', { expected: '+5', measured: '+3' }));
    fireEvent.blur(screen.getByLabelText(tr('expectedDelta')), { target: { value: ' ' } });
    expect(readTasks('p')[0]).not.toHaveProperty('expectedDelta');
  });

  it('turns a link injection into a task carrying the solver gain', () => {
    const row = (expectedSprGain: number | null, targetUrl: string): LinkInjection => ({
      id: `${A}=>${targetUrl}`, sourceUrl: A, sourceTitle: 'A', targetUrl, targetTitle: 'T', sharedTerms: ['solar'], weightedJaccard: 0.5,
      section: { heading: 'Guide', level: 2, index: 0, termHits: 2, matchedTerms: ['solar'] }, expectedSprGain,
      language: 'en', languageFallback: false, anchor: 'T', html: '<p></p>', markdown: '',
    });
    render(<ContextualLinkInjectorPanel injections={[row(4.2, B), row(null, `${B}2`)]} projectId="p" baselineScoreFor={() => 40} />);
    screen.getAllByRole('button', { name: tr('add') }).forEach((button) => fireEvent.click(button));
    const tasks = readTasks('p');
    expect(tasks.map((task) => [task.kind, task.module, task.url, task.targetUrl, task.baselineScore, task.expectedDelta]))
      .toEqual([['add-link', 'sprs', A, B, 40, 4.2], ['add-link', 'sprs', A, `${B}2`, 40, undefined]]);
  });

  it('shows no task button without a project', () => {
    render(<ContextualLinkInjectorPanel injections={[]} />);
    expect(screen.queryByRole('button', { name: tr('add') })).toBeNull();
  });
});
