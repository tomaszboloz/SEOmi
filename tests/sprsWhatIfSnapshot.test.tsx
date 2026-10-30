import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import i18n from '@/i18n';

import { simulateWhatIfRun } from '@/services/semanticGraph/sprs';
import { SprsWhatIf } from '@/components/Charts/SprsWhatIf';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { buildSprsInput } from '@/components/Charts/semanticTopical/signals/sprsAdapter';
import { useGraphSnapshot } from '@/components/Charts/semanticTopical/signals/useGraphSnapshot';
import type { SemanticMap } from '@/services/semanticGraph/types';
import type { CrawledPageSummary } from '@/types';

vi.mock('@/services/semanticGraph/sprs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/semanticGraph/sprs')>();
  return { ...actual, simulateWhatIfRun: vi.fn(actual.simulateWhatIfRun) };
});

const A = 'https://a.test/', B = 'https://a.test/b', C = 'https://a.test/c', D = 'https://a.test/d';
const page = (url: string) => ({ url, final_url: url, http_status: 200 }) as unknown as CrawledPageSummary;
const graph = (urls: string[], edges: Array<[string, string]>) => ({
  nodes: urls.map((url) => ({ id: url, page: page(url), clusterId: 'c', clusterLabel: 'c', semanticSignalCount: 0, incomingContentLinks: 0, orphan: false })),
  edges: edges.map(([source, target]) => ({ id: `${source}>${target}`, source, target, links: 1 })),
  topicEdges: [],
}) as unknown as SemanticMap;

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

const nodes = [A, B, C].map((id) => ({ id }));
const edges = [{ source: A, target: B, links: 1 }, { source: B, target: C, links: 1 }, { source: C, target: A, links: 1 }];
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

it('simulates adding a link on the frozen graph and ranks rows by absolute change', () => {
  render(<SprsWhatIf nodes={[...nodes, { id: D }]} edges={edges} />);
  const run = screen.getByRole('button', { name: 'Simulate' }) as HTMLButtonElement;
  expect(run.disabled).toBe(true);
  pick('From page', A); pick('To page', D);
  expect(run.disabled).toBe(false);
  fireEvent.click(run);
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows.length).toBeGreaterThan(0);
  const targetCell = screen.getByRole('cell', { name: D });
  expect(targetCell.textContent?.trim()).toBe(D);
  const pageCells = rows.map((row) => row.querySelector('td')?.textContent?.trim());
  expect(pageCells).toContain(D);
  const lookalike = `${D}.attacker.com`;
  expect(screen.queryByRole('cell', { name: lookalike })).toBeNull();
  expect(pageCells).not.toContain(lookalike);
  expect(edges).toHaveLength(3);
  pick('To page', B);
  expect(screen.queryByRole('table')).toBeNull();
});

it('rejects invalid choices: same page, duplicate add, removing a link that does not exist', () => {
  render(<SprsWhatIf nodes={nodes} edges={edges} />);
  const run = screen.getByRole('button', { name: 'Simulate' }) as HTMLButtonElement;
  pick('From page', A); pick('To page', A);
  expect(run.disabled).toBe(true);
  pick('To page', B);
  expect(run.disabled).toBe(true);
  pick('Change', 'remove');
  expect(run.disabled).toBe(false);
  pick('To page', C);
  expect(run.disabled).toBe(true);
});

it('reports when a simulation changes no score and shows a table after removing a link', () => {
  const lone = [{ id: A }, { id: B }];
  render(<SprsWhatIf nodes={lone} edges={[{ source: A, target: B, links: 1 }]} />);
  vi.mocked(simulateWhatIfRun).mockReturnValueOnce({ rows: [], converged: true, iterations: 1, residual: 0, issues: [], uncertain: false });
  pick('From page', B); pick('To page', A);
  fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
  expect(screen.getByRole('status').textContent).toBe('No score changes.');
  pick('From page', A); pick('To page', B); pick('Change', 'remove');
  fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('table')).toBeTruthy();
  expect(screen.getByText(/^Warm-started from the current scores: \d+ iterations, residual /)).toBeTruthy();
  vi.mocked(simulateWhatIfRun).mockReturnValueOnce({ rows: [], converged: false, iterations: 150, residual: 0.01, issues: [], uncertain: true });
  fireEvent.click(screen.getByRole('button', { name: 'Simulate' }));
  expect(screen.getByText('The solver did not converge; scores are approximate.')).toBeTruthy();
});

it('renders nothing for fewer than two pages', () => {
  const { container } = render(<SprsWhatIf nodes={[{ id: A }]} edges={[]} />);
  expect(container.innerHTML).toBe('');
});

it('keeps the opened snapshot while a newer graph arrives and adopts it on refresh', () => {
  const first = graph([A, B], [[A, B]]);
  const second = graph([A, B, C], [[A, B], [B, C]]);
  const { result, rerender } = renderHook(({ value }) => useGraphSnapshot(value), { initialProps: { value: first } });
  expect(result.current).toMatchObject({ snapshot: first, stale: false });
  rerender({ value: second });
  expect(result.current.snapshot).toBe(first);
  expect(result.current.stale).toBe(true);
  act(() => result.current.refresh());
  expect(result.current).toMatchObject({ snapshot: second, stale: false });
});

it('shows the stale banner in the signals workspace and refreshes to the new crawl', () => {
  const pages = [page(A), page(B), page(C)];
  const { rerender } = render(<SignalsWorkspace pages={pages} graph={graph([A, B], [[A, B]])} />);
  expect(screen.queryByTestId('stale-snapshot-banner')).toBeNull();
  rerender(<SignalsWorkspace pages={pages} graph={graph([A, B, C], [[A, B], [B, C]])} />);
  expect(screen.getByTestId('stale-snapshot-banner').textContent).toContain('Newer crawl data is available.');
  expect(buildSprsInput(graph([A, B], [[A, B]])).nodes).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(screen.queryByTestId('stale-snapshot-banner')).toBeNull();
});

it('translates every What-If string in all locales', async () => {
  const english = (await import('@/i18n/locales/en.json')).default.sprsUi.whatIf;
  for (const locale of ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']) {
    const block = (await import(`@/i18n/locales/${locale}.json`)).default.sprsUi.whatIf as Record<string, string>;
    expect(Object.keys(block).sort(), locale).toEqual(Object.keys(english).sort());
    if (locale !== 'en') expect(block.title, locale).not.toBe(english.title);
  }
});
