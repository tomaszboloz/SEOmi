import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { DeploymentArtifactsPanel } from '@/components/Charts/DeploymentArtifactsPanel';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';
import { LinksWorkspace } from '@/components/Charts/semanticTopical/LinksWorkspace';
import { AddTaskButton, OptimizationTaskTracker } from '@/components/Charts/OptimizationTaskTracker';
import { GateBanner } from '@/components/Domain/crawlResults/focus/GateBanner';
import { PagePlaybookPanel } from '@/components/Domain/crawlResults/focus/PagePlaybookPanel';
import { buildSiteFocusReport } from '@/services/siteFocus';
import * as taskStorage from '@/services/optimizationTasks/storage';
import { readTasks } from '@/services/optimizationTasks/storage';
import { readMetricHistory } from '@/services/optimizationTasks/metricHistory';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { useProjectStore } from '@/stores/projectStore';
import { createCrawlPageFixture as page, createCrawlRunFixture } from './fixtures/crawl';
import { diabetesSite } from './siteFocusFixtures';

const addLabel = () => i18n.t('executionCard.tasks.add') as string;
const project = 'task130-v3';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
  useProjectStore.setState({ activeProjectId: project });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });

describe('issue 130 v3 mounted task CTAs', () => {
  it('persists an add-link task from a measured internal-link candidate', () => {
    const pages = [
      page({ url: 'https://task130.test/source', final_url: 'https://task130.test/source', title: 'Solar source', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
      page({ url: 'https://task130.test/target', final_url: 'https://task130.test/target', title: 'Solar target', semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
    ];
    render(<InternalLinkOpportunitiesPanel pages={pages} projectId={project} baselineScoreFor={() => 41} />);
    const add = screen.getAllByRole('button', { name: addLabel() })[0];
    fireEvent.click(add);
    fireEvent.click(add);
    expect(readTasks(project)).toMatchObject([{ kind: 'add-link', module: 'sprs', url: 'https://task130.test/source', targetUrl: 'https://task130.test/target', baselineScore: 41, status: 'planned' }]);
    expect(readTasks('another-project')).toEqual([]);
  });

  it('persists one planned task for each valid 301/410 deployment rule', () => {
    render(<DeploymentArtifactsPanel projectId={project} baselineScoreFor={() => 72} rules={[
      { from: 'https://task130.test/old', to: 'https://task130.test/new', status: 301 },
      { from: 'https://task130.test/gone', to: null, status: 410 },
    ]} />);
    screen.getAllByRole('button', { name: addLabel() }).forEach((button) => fireEvent.click(button));
    expect(readTasks(project)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'redirect-301', module: 'tas', url: 'https://task130.test/old', targetUrl: 'https://task130.test/new', baselineScore: 72, status: 'planned' }),
      expect.objectContaining({ kind: 'remove-410', module: 'sfs', url: 'https://task130.test/gone', baselineScore: 72, status: 'planned' }),
    ]));
  });

  it('persists remove-noindex only when the mounted conflict has crawl evidence', () => {
    const noindex = page({ url: 'https://task130.test/noindex', final_url: 'https://task130.test/noindex', meta_robots: 'noindex', indexability_status: 'Blocked by noindex' });
    const report = buildSiteFocusReport([noindex], noindex.url, { includeNonIndexable: true });
    render(<GateBanner report={report} pages={[noindex]} included={false} onToggle={() => undefined} sitemapUrls={[noindex.url]} projectId={project} baselineScore={report.unavailable ? null : report.score} />);
    fireEvent.click(screen.getByRole('button', { name: addLabel() }));
    expect(readTasks(project)).toMatchObject([{ kind: 'remove-noindex', module: 'sfs', url: noindex.url, baselineScore: report.unavailable ? null : report.score, status: 'planned' }]);
  });

  it('retains the existing mounted entity CTA and nulls an unavailable score', () => {
    const report = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/');
    const target = report.pages.find((candidate) => !candidate.skipped && candidate.playbook !== 'C');
    expect(target).toBeDefined();
    render(<PagePlaybookPanel page={target!} report={{ ...report, unavailable: true, score: 0 }} projectId={project} baselineScore={null} />);
    fireEvent.click(screen.getByRole('button', { name: addLabel() }));
    expect(readTasks(project)).toMatchObject([{ kind: 'add-entities', module: 'sfs', url: target!.url, baselineScore: null, status: 'planned' }]);
  });

  it('refreshes the same mounted LinksWorkspace tracker after an internal-link CTA', () => {
    const pages = [
      page({ url: 'https://task130.test/source', final_url: 'https://task130.test/source', title: 'Solar source', word_count: 900, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
      page({ url: 'https://task130.test/target', final_url: 'https://task130.test/target', title: 'Solar target', word_count: 900, semantic_terms: ['solar', 'panel', 'guide'], semantic_links: [] }),
    ];
    render(<LinksWorkspace projectId={project} pages={pages} />);
    expect(screen.getByText(i18n.t('executionCard.tasks.empty') as string)).toBeTruthy();
    const addButtons = screen.getAllByRole('button', { name: addLabel() });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);
    fireEvent.click(addButtons[0]);
    const tracker = screen.getByRole('region', { name: i18n.t('executionCard.tasks.aria') as string });
    expect(tracker.textContent).toContain(`${i18n.t('executionCard.tasks.kind.add-link')}: https://task130.test/source`);
    expect(tracker.textContent).toContain(i18n.t('executionCard.tasks.status.planned') as string);
    expect(readTasks(project)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.markImplemented') as string }));
    expect(readTasks(project)[0].status).toBe('implemented');
    expect(tracker.textContent).toContain(i18n.t('executionCard.tasks.status.implemented') as string);
    expect(readTasks('other-project')).toEqual([]);
  });

  it('only calls onAdded after storage success and resets its status on project switch', () => {
    const onAdded = vi.fn();
    const view = render(<AddTaskButton projectId={project} task={{ kind: 'add-link', module: 'sprs', url: 'https://task130.test/source', targetUrl: 'https://task130.test/target', baselineScore: null }} onAdded={onAdded} />);
    fireEvent.click(screen.getByRole('button', { name: addLabel() }));
    expect(onAdded).toHaveBeenCalledOnce();
    expect(screen.getByRole('status')).toBeTruthy();
    view.rerender(<AddTaskButton projectId="switched-project" task={{ kind: 'add-link', module: 'sprs', url: 'https://task130.test/source', targetUrl: 'https://task130.test/target', baselineScore: null }} onAdded={onAdded} />);
    expect(screen.queryByRole('status')).toBeNull();
    const failed = vi.spyOn(taskStorage, 'writeTasks').mockReturnValue(false);
    const failedCallback = vi.fn();
    cleanup();
    render(<AddTaskButton projectId="failed-project" task={{ kind: 'remove-410', module: 'sfs', url: 'https://task130.test/gone', baselineScore: null }} onAdded={failedCallback} />);
    fireEvent.click(screen.getByRole('button', { name: addLabel() }));
    expect(failedCallback).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    failed.mockRestore();
  });

  it('does not publish task metrics or storage events when manual verification persistence fails', () => {
    taskStorage.writeTasks(project, [{ id: 'failed-save', kind: 'remove-410', module: 'sfs', status: 'implemented', url: 'https://task130.test/gone', baselineScore: 60, priority: 'medium', createdAt: '2026-01-01T00:00:00Z', implementedAt: '2026-01-01T00:00:00Z' }]);
    const event = vi.fn();
    window.addEventListener(taskStorage.OPTIMIZATION_TASKS_STORAGE_EVENT, event);
    const failed = vi.spyOn(taskStorage, 'writeTasks').mockReturnValue(false);
    render(<OptimizationTaskTracker projectId={project} pages={[page({ url: 'https://task130.test/gone', final_url: 'https://task130.test/gone', http_status: 200 })]} scoreFor={() => 55} crawlStartedAt="2026-10-26T10:00:00Z" />);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('executionCard.tasks.verify') as string }));
    expect(readTasks(project)[0].status).toBe('implemented');
    expect(readMetricHistory(project)).toEqual([]);
    expect(event).not.toHaveBeenCalled();
    failed.mockRestore();
    window.removeEventListener(taskStorage.OPTIMIZATION_TASKS_STORAGE_EVENT, event);
  });

  it('does not return a verified result or append deltas when crawl verification cannot persist', () => {
    taskStorage.writeTasks(project, [{ id: 'failed-run-save', kind: 'remove-410', module: 'sfs', status: 'implemented', url: 'https://task130.test/gone', baselineScore: 60, priority: 'medium', createdAt: '2026-01-01T00:00:00Z', implementedAt: '2026-01-01T00:00:00Z' }]);
    const failed = vi.spyOn(taskStorage, 'writeTasks').mockReturnValue(false);
    const result = runTaskVerification(project, createCrawlRunFixture({ startedAt: '2026-10-26T11:00:00Z', completedAt: '2026-10-26T11:01:00Z', result: { ...createCrawlRunFixture().result, start_url: 'https://task130.test/', pages: [page({ url: 'https://task130.test/gone', final_url: 'https://task130.test/gone', http_status: 410 })], duration_ms: 60_000 } }));
    expect(result[0].status).toBe('implemented');
    expect(readMetricHistory(project)).toEqual([]);
    failed.mockRestore();
  });

  it('uses explicit producer ownership instead of the unrelated active project', () => {
    const report = buildSiteFocusReport(diabetesSite(), 'https://diabetes.test/');
    const target = report.pages.find((candidate) => !candidate.skipped && candidate.playbook !== 'C');
    expect(target).toBeDefined();
    useProjectStore.setState({ activeProjectId: 'active-project-b' });
    render(<PagePlaybookPanel page={target!} report={report} projectId="reported-project-a" baselineScore={null} />);
    fireEvent.click(screen.getByRole('button', { name: addLabel() }));
    expect(readTasks('reported-project-a')[0]).toMatchObject({ kind: 'add-entities', url: target!.url });
    expect(readTasks('active-project-b')).toEqual([]);
  });
});
