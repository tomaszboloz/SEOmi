import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { BriefCardButton, BriefNavigationContext } from '@/components/Charts/BriefCardButton';
import { OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { takePendingBrief } from '@/services/executionCard/openBrief';
import { readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { readTasks, writeTasks } from '@/services/optimizationTasks/storage';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlPageFixture as page } from './fixtures/crawl';

const A = 'https://s.test/a';
const tr = (k: string) => i18n.t(`executionCard.tasks.${k}`) as string;
const base = { id: 't1', kind: 'remove-410', module: 'sfs', status: 'planned', url: A, baselineScore: 50, priority: 'medium', createdAt: 'x' } as const;

describe('task tracker meta editing', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T10:00:00Z')); });
  afterEach(() => vi.useRealTimers());
  it('edits owner, priority, SLA, filters and records delta on verify', () => {
    writeTasks('p', [{ ...base, dueDate: '2020-01-01' }, { ...base, id: 't2', owner: 'Ann' }]);
    render(<OptimizationTaskTracker projectId="p" pages={[page({ url: A, final_url: A, http_status: 410 })]} scoreFor={() => 58} crawlStartedAt="2099-01-01T00:00:00Z" />);
    expect(screen.getByRole('status').textContent).toBe(tr('overdue'));
    const owners = screen.getAllByLabelText(tr('owner'));
    fireEvent.change(owners[0], { target: { value: 'Bob' } });
    fireEvent.blur(owners[0]);
    fireEvent.change(screen.getAllByLabelText(tr('priority'))[0], { target: { value: 'high' } });
    fireEvent.change(screen.getAllByLabelText(tr('dueDate'))[1], { target: { value: '2030-01-01' } });
    expect(readTasks('p')[0]).toMatchObject({ owner: 'Bob', priority: 'high' });
    expect(readTasks('p')[1].dueDate).toBe('2030-01-01');
    fireEvent.click(screen.getByRole('button', { name: tr('filter.overdue') }));
    expect(screen.getAllByLabelText(tr('owner'))).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: tr('filter.mine') }));
    fireEvent.change(screen.getByLabelText(tr('me')), { target: { value: 'ann' } });
    expect(screen.getAllByLabelText(tr('owner'))).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: tr('filter.all') }));
    fireEvent.click(screen.getAllByRole('button', { name: tr('markImplemented') })[0]);
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
    expect(readMetricHistory('p')).toHaveLength(1);
  });
});

describe('BriefCardButton', () => {
  beforeEach(() => localStorage.clear());
  it('renders nothing without a project', () => {
    useProjectStore.setState({ activeProjectId: null });
    const { container } = render(<BriefCardButton input={{ origin: 'sfs', title: 't', sourceUrl: A }} />);
    expect(container.textContent).toBe('');
  });
  it('creates the brief and opens the workstation', () => {
    useProjectStore.setState({ activeProjectId: 'p' });
    const open = vi.fn();
    render(<BriefNavigationContext.Provider value={open}><BriefCardButton input={{ origin: 'tas', title: 't', sourceUrl: A, missingEntities: ['x'] }} /></BriefNavigationContext.Provider>);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') as string }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(takePendingBrief()).toBeTruthy();
  });
  it('works without a host callback', () => {
    useProjectStore.setState({ activeProjectId: 'p' });
    render(<BriefCardButton input={{ origin: 'sfs', title: 't', sourceUrl: A }} />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.brief.open') as string }));
    expect(takePendingBrief()).toBeTruthy();
  });
});

describe('LinksWorkspace', () => {
  beforeEach(() => localStorage.clear());
  it('renders the panels with and without project / pages', () => {
    const { rerender } = render(<LinksWorkspace projectId={null} pages={[]} />);
    expect(screen.queryByLabelText(i18n.t('executionCard.tasks.aria') as string)).toBeNull();
    writeTasks('p', [{ ...base }, { ...base, id: 't2', module: 'tas' }, { ...base, id: 't3', module: 'sprs' }]);
    const selectedPages = [page({ url: A, final_url: A })];
    rerender(<LinksWorkspace projectId="p" pages={selectedPages} run={{ id: 'run-p', startedAt: '2026-10-25T00:00:00Z', completedAt: '2026-10-25T00:01:00Z', result: { pages: selectedPages, cancelled: false } } as never} />);
    expect(screen.getByLabelText(i18n.t('executionCard.tasks.aria') as string)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: tr('verify') }));
  });
  it('survives incomplete pages', () => {
    const broken = { url: A, final_url: A } as never;
    expect(() => render(<LinksWorkspace projectId={null} pages={[broken]} />)).not.toThrow();
  });
});
