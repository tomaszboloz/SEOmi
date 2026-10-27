import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HreflangParityPanel } from '@/components/Charts/HreflangParityPanel';

describe('HreflangParityPanel', () => {
  it('lists gaps when inconclusive', () => {
    const { container } = render(<HreflangParityPanel report={{ status: 'inconclusive', rows: [], gaps: ['partial-crawl'] }} />);
    expect(container.textContent).toContain('parityUi.gap.partial-crawl');
    expect(container.querySelector('table')).toBeNull();
  });
  it('renders rows when ready', () => {
    const { container } = render(<HreflangParityPanel report={{ status: 'ready', gaps: [], rows: [{ language: 'de', topic: 'a', status: 'shallow', depth: 1, referenceDepth: 5 }] }} />);
    expect(container.textContent).toContain('parityUi.statuses.shallow');
  });
});
