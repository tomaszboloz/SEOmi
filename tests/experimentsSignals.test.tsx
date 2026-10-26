import { afterEach, beforeEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n';
import { SignalsWorkspace } from '@/components/Charts/semanticTopical/signals/SignalsWorkspace';
import { addIntervention } from '@/services/experiments/registry';
import type { SemanticMap } from '@/services/semanticGraph/types';
import { intervention, savedExperimentPair } from './fixtures/experiments';

const graph: SemanticMap = {
  nodes: [], edges: [], topicEdges: [], clusters: [], totalEdges: 0, totalTopicEdges: 0,
  totalInternalLinks: 0, hasSemanticTerms: false, truncated: false,
};
beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });
afterEach(cleanup);

it('mounts experiments alongside the unchanged causal panel, using only the active project snapshots', () => {
  savedExperimentPair();
  addIntervention('p1', intervention);
  addIntervention('p2', intervention);
  const view = render(<SignalsWorkspace projectId="p1" pages={[]} graph={graph} />);
  const panel = () => within(screen.getByRole('region', { name: 'SEO experiments' }));
  expect(panel().getByRole('status').textContent).toBe('Observation available');
  expect(screen.getByTestId('causal-impact-panel')).toBeTruthy();
  view.rerender(<SignalsWorkspace projectId="p2" pages={[]} graph={graph} />);
  expect(panel().getByRole('status').textContent).toBe('Inconclusive');
  expect(panel().getByText('No saved period ends before the intervention.')).toBeTruthy();
});
