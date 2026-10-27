import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { CausalImpactPanel } from '@/components/Results/CausalImpactPanel';
import type { ImpactResult } from '@/services/causalMarket';

const result: ImpactResult = {
  effect: 4.25, lower: 1, upper: 7.5, relativeEffect: 0.1, marketNormalized: true, updateWindow: false,
  affectedDates: [], verdict: 'positive', reason: null, marketSource: 'test-source', controlSource: 'test-control',
};

describe('CausalImpactPanel', () => {
  it('shows the empty state without a result', () => {
    render(<CausalImpactPanel result={null} />);
    expect(screen.getByTestId('causal-impact-panel').textContent).toContain('Not estimable');
  });

  it('shows verdict, interval and normalization', () => {
    render(<CausalImpactPanel result={result} />);
    const text = screen.getByTestId('causal-impact-panel').textContent ?? '';
    expect(text).toContain('Positive effect');
    expect(text).toContain('(1.0 to 7.5)');
    expect(text).toContain('Normalized by market baseline');
    expect(text).toContain('test-source');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('flags update windows and covers every verdict label', () => {
    const verdicts = ['negative', 'no-effect', 'inconclusive'] as const;
    for (const verdict of verdicts) {
      const { unmount } = render(<CausalImpactPanel result={{ ...result, verdict, marketNormalized: false, updateWindow: verdict === 'inconclusive' }} />);
      unmount();
    }
    render(<CausalImpactPanel result={{ ...result, verdict: 'inconclusive', updateWindow: true }} />);
    expect(screen.getByRole('alert').textContent).toContain('inconclusive');
  });

  it('explains missing evidence without claiming a causal result', () => {
    render(<CausalImpactPanel result={{ ...result, verdict: 'inconclusive', marketNormalized: false, reason: 'market-unavailable', marketSource: null, controlSource: null }} />);
    expect(screen.getByRole('status').textContent).toContain('External market');
  });

  it('marks missing independent control evidence as inconclusive', () => {
    render(<CausalImpactPanel result={{ ...result, verdict: 'inconclusive', reason: 'control-unavailable', controlSource: null }} />);
    expect(screen.getByRole('status').textContent).toContain('Independent control');
    expect(screen.getByTestId('causal-impact-panel').textContent).toContain('unknown');
  });
});
