import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { DomainComparisonSection } from '@/components/Domain/domainOverview/DomainComparisonSection';
import type { DomainOverviewSession } from '@/components/Domain/domainOverview/useDomainOverviewSession';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;

const session = (patch: Record<string, unknown> = {}) => ({
  t, inputDomain: 'main.test', comparisonInput: '', setComparisonInput: vi.fn(),
  domainOverview: null, domainComparison: null, domainComparisonHistory: [],
  isDomainComparisonLoading: false, domainComparisonError: null,
  setDomainComparisonTargets: vi.fn(), handleCompareDomains: vi.fn(), ...patch,
}) as unknown as DomainOverviewSession;

describe('domain comparison section edge contracts', () => {
  it('normalizes competitor separators and falls back to the input domain', () => {
    const current = session({ comparisonInput: 'a.test,b.test,c.test' });
    render(<DomainComparisonSection session={current} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' a.test, b.test\nc.test ' } });

    expect(current.setComparisonInput).toHaveBeenCalledWith(' a.test, b.test\nc.test ');
    expect(current.setDomainComparisonTargets).toHaveBeenCalledWith([
      'main.test', 'a.test', 'b.test', 'c.test',
    ]);
    expect(screen.getByText(/dataforseo\.paidRequests/).textContent).toContain('20');
  });

  it('shows the loading control and an observed comparison error', () => {
    const current = session({ isDomainComparisonLoading: true, domainComparisonError: 'provider failed' });
    render(<DomainComparisonSection session={current} />);

    expect(screen.getByRole('alert').textContent).toBe('provider failed');
    expect((screen.getByRole('button', { name: 'domainResearchUi.compareLive' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
