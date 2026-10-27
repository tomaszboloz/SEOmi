import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { DecayRadarPanel } from '@/components/Charts/DecayRadarPanel';
import type { DecayEvaluation } from '@/services/semanticDecay/alert';

const ready = { status: 'ready' as const, incompatible: [], centroidShift: 0.2, newEntities: ['N'], lostEntities: ['L'], intentChange: { from: 'a', to: 'b' }, formatChange: { from: 'x', to: 'y' }, addedUrls: ['u1'], removedUrls: ['u2'] };

describe('DecayRadarPanel', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });
  it('renders verdict only without a comparison', () => {
    const { container } = render(<DecayRadarPanel evaluation={{ verdict: 'too-few-samples', comparison: null, dedupeKey: null, reasons: [] }} />);
    expect(container.textContent).toContain('Not enough comparable SERP snapshots');
    expect(container.textContent).toContain('Snapshots supporting this verdict: 0');
    expect(container.querySelector('ul')).toBeNull();
  });
  it('renders cited changes', () => {
    const evaluation: DecayEvaluation = { verdict: 'alert', comparison: ready, dedupeKey: 'k', reasons: ['centroid'] };
    const { container } = render(<DecayRadarPanel evaluation={evaluation} snapshotCount={3} />);
    expect(container.querySelectorAll('li').length).toBe(7);
    expect(container.textContent).toContain('u2');
    expect(container.textContent).toContain('Snapshots supporting this verdict: 3');
  });
  it('renders sparse changes and null shift', () => {
    const sparse = { ...ready, centroidShift: null, newEntities: [], lostEntities: [], intentChange: null, formatChange: null, addedUrls: [], removedUrls: [] };
    const { container } = render(<DecayRadarPanel evaluation={{ verdict: 'stable', comparison: sparse, dedupeKey: null, reasons: [] }} />);
    expect(container.querySelectorAll('li').length).toBe(1);
  });
  it('explains incompatibility', () => {
    const bad = { ...ready, status: 'incompatible' as const, incompatible: ['model' as const] };
    const { container } = render(<DecayRadarPanel evaluation={{ verdict: 'incompatible', comparison: bad, dedupeKey: null, reasons: [] }} />);
    expect(container.textContent).toContain('Different model: not a market change.');
  });
});
