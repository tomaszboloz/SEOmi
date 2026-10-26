import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { ExperimentsPanel } from '@/components/Charts/ExperimentsPanel';
import { addIntervention } from '@/services/experiments/registry';
import { experimentPage, intervention, savedExperimentPair, savedExperimentSnapshot } from './fixtures/experiments';

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('displays whole-site measurements with unavailable controls and an explicit limitation', () => {
  savedExperimentPair();
  addIntervention('p1', { ...intervention, url: 'site' });
  render(<ExperimentsPanel projectId="p1" pages={[]} />);
  expect(screen.getByRole('heading', { name: 'Whole site' })).toBeTruthy();
  expect(screen.getByText('A whole-site intervention has no separate rest-of-site control.')).toBeTruthy();
  expect(screen.getAllByText(/: Unavailable$/)).toHaveLength(2);
  expect(screen.getAllByText(/: Unavailable · Unavailable$/)).toHaveLength(2);
  expect(screen.getAllByText('+20%')).toHaveLength(2);
});

it('renders null relative metrics as unavailable instead of infinity or misleading zero', () => {
  savedExperimentPair();
  addIntervention('p1', { ...intervention, url: 'https://example.com/missing' });
  render(<ExperimentsPanel projectId="p1" pages={[]} />);
  const clicks = within(screen.getByRole('row', { name: 'Clicks 0 0 Unavailable' }));
  expect(clicks.getByText('Unavailable')).toBeTruthy();
  expect(screen.getByText('A zero baseline makes the relative change unavailable.')).toBeTruthy();
  expect(screen.getByRole('article').textContent).not.toMatch(/Infinity|NaN/);
});

it('shows positive position difference with an explicit sign', () => {
  savedExperimentSnapshot();
  savedExperimentSnapshot('2026-09-11', '2026-09-20', { pages: [experimentPage(40, 400, 11)] });
  addIntervention('p1', intervention);
  render(<ExperimentsPanel projectId="p1" pages={[]} />);
  expect(screen.getByText('+3')).toBeTruthy();
});
