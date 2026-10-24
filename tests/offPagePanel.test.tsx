import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OffPagePanel } from '@/components/Charts/OffPagePanel';
import type { TbvaReport } from '@/services/offPage/tbva';

const none: TbvaReport = { status: 'unavailable', tbva: null, counted: 0, nofollow: 0, duplicateDomains: 0, unscored: 0, coverage: null, limitations: [] };
const empty = { linked: [], unlinked: [], inspected: 0, note: 'no-source-text' as const };

describe('OffPagePanel', () => {
  it('shows empty states', () => {
    const { container } = render(<OffPagePanel tbva={none} coCitation={empty} />);
    expect(container.textContent).toContain('offPageUi.empty');
    expect(container.textContent).toContain('offPageUi.noText');
  });
  it('shows value, partial and nofollow notes', () => {
    const tbva: TbvaReport = { ...none, status: 'partial', tbva: 1.5, counted: 2, nofollow: 3, unscored: 1, coverage: 0.5 };
    const { container } = render(<OffPagePanel tbva={tbva} coCitation={{ ...empty, note: 'ready', inspected: 4 }} />);
    ['offPageUi.tbva', 'offPageUi.partial', 'offPageUi.nofollow', 'offPageUi.coCitation'].forEach((k) => expect(container.textContent).toContain(k));
    const nullCoverage = render(<OffPagePanel tbva={{ ...tbva, coverage: null }} coCitation={empty} />);
    expect(nullCoverage.container.textContent).toContain('offPageUi.tbva');
  });
});
