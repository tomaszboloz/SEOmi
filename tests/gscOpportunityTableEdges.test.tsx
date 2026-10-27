import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GscOpportunities } from '@/components/AgentWorkflows/GscOpportunities';
import { snapshotGscPerformance } from '@/services/gscPerformanceTracker';
import { gscData } from './fixtures/gscTracker';
import i18n from '@/i18n';

const query = (name: string, clicks: number, position = 12) => ({
  query: name, clicks, impressions: 100, ctr: clicks, position,
});
const renderRows = (queries: ReturnType<typeof query>[]) => render(
  <GscOpportunities snapshot={snapshotGscPerformance(gscData({ queries }))} />,
);
const firstQuery = () => within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0].textContent;
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('sorts the CTR benchmark by the displayed peer value and resets a hidden sort', () => {
  renderRows([
    query('low benchmark', 0, 3), ...['a', 'b', 'c'].map(name => query(name, 15, 3)),
    query('high benchmark', 12, 13), ...['d', 'e', 'f'].map(name => query(name, 25, 13)),
  ]);
  fireEvent.click(screen.getByRole('tab', { name: /CTR outliers/ }));
  fireEvent.click(screen.getByRole('button', { name: 'CTR benchmark' }));
  expect(firstQuery()).toBe('high benchmark');
  fireEvent.click(screen.getByRole('button', { name: 'CTR benchmark' }));
  expect(firstQuery()).toBe('low benchmark');
  fireEvent.click(screen.getByRole('tab', { name: /All queries/ }));
  expect(screen.getByRole('columnheader', { name: 'Query' }).getAttribute('aria-sort')).toBe('ascending');
  expect(firstQuery()).toBe('a');
});

it('keeps unknown metrics at the end in either direction and shows a dash', () => {
  renderRows([query('unknown', Number.NaN, Number.NaN), query('known zero', 0), query('known ten', 10)]);
  fireEvent.click(screen.getByRole('button', { name: 'Clicks' }));
  expect(firstQuery()).toBe('known ten');
  expect(within(screen.getAllByRole('row')[3]).getAllByText('—')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Clicks' }));
  expect(firstQuery()).toBe('known zero');
  expect(within(screen.getAllByRole('row')[3]).getByText('unknown')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'CTR' }));
  expect(firstQuery()).toBe('known ten');
  fireEvent.click(screen.getByRole('button', { name: 'Position' }));
  expect(firstQuery()).toBe('known ten');
});

it('supports all tab navigation keys and ignores unrelated keys', () => {
  renderRows([query('near', 1)]);
  const tabs = screen.getAllByRole('tab');
  fireEvent.keyDown(tabs[0], { key: 'End' });
  expect(document.activeElement).toBe(tabs[2]);
  fireEvent.keyDown(tabs[2], { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(tabs[1]);
  fireEvent.keyDown(tabs[1], { key: 'Home' });
  expect(document.activeElement).toBe(tabs[0]);
  fireEvent.keyDown(tabs[0], { key: 'Escape' });
  expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
  expect(document.activeElement).toBe(tabs[2]);
});
