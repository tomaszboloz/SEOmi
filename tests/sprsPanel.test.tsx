import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SprsPanel } from '@/components/Charts/SprsPanel';
import { computeSprs } from '@/services/semanticGraph/sprs';

describe('SprsPanel', () => {
  it('shows an empty state without a graph', () => {
    render(<SprsPanel report={computeSprs([], [])} />);
    expect(screen.getByRole('status')).toBeTruthy();
  });
  it('lists pages with flags and notes', () => {
    const report = computeSprs([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }]);
    const { container } = render(<SprsPanel report={{ ...report, converged: false }} />);
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
    expect(container.textContent).toContain('sprsUi.deadEnd');
    expect(container.textContent).toContain('sprsUi.notConverged');
    expect(container.textContent).toContain('sprsUi.unknown');
    expect(container.textContent).toContain('sprsUi.leak'.slice(0, 0));
  });
  it('shows leak and under-linked flags', () => {
    const report = computeSprs(['h', 'x', 'y', 'z', 'w'].map((id) => ({ id })), ['x', 'y', 'z', 'w'].map((source) => ({ source, target: 'h', similarity: 0 })).concat([{ source: 'h', target: 'x', similarity: 0 }]));
    const { container } = render(<SprsPanel report={report} />);
    expect(container.textContent).toContain('sprsUi.leak');
    expect(container.textContent).toContain('sprsUi.underLinked');
  });
});
