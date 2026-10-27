import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OverviewCoverageCard } from '@/components/Results/overview/OverviewCoverageCard';
import { OverviewCoverageFilters } from '@/components/Results/overview/OverviewCoverageFilters';
import { OverviewCoveragePagination } from '@/components/Results/overview/OverviewCoveragePagination';
import { Overview } from '@/components/Results/Overview';
import type { LocalAuditCheck } from '@/services/auditChecks';

import { mockAudit } from './fixtures/auditStoreContracts';

describe('unreferenced components batch 5 direct assertions', () => {
  it('OverviewCoverageCard renders check label and status evidence', () => {
    const item: LocalAuditCheck = {
      id: 'csp',
      category: 'Security',
      label: 'Content Security Policy',
      status: 'pass',
      evidence: 'CSP declared',
    };

    render(<OverviewCoverageCard item={item} />);
    expect(screen.getByText('Content Security Policy')).toBeTruthy();
    expect(screen.getByText('CSP declared')).toBeTruthy();
  });

  it('OverviewCoverageFilters renders search input and selects', () => {
    const resetPage = vi.fn();
    const setQuery = vi.fn();
    const setStatus = vi.fn();
    render(
      <OverviewCoverageFilters
        localCheckQuery=""
        setLocalCheckQuery={setQuery}
        localCheckStatus="all"
        setLocalCheckStatus={setStatus}
        localCheckCategory="all"
        setLocalCheckCategory={vi.fn()}
        localCheckCategories={['Security', 'Performance']}
        resetPage={resetPage}
      />,
    );

    const query = screen.getByRole('textbox');
    fireEvent.change(query, { target: { value: 'CSP' } });
    expect(setQuery).toHaveBeenCalledWith('CSP');
    expect(resetPage).toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'pass' } });
    expect(setStatus).toHaveBeenCalledWith('pass');
    expect(resetPage).toHaveBeenCalled();
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Performance' } });
    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(resetPage).toHaveBeenCalledTimes(3);
  });

  it('OverviewCoveragePagination renders pagination buttons', () => {
    const onNext = vi.fn();
    render(
      <OverviewCoveragePagination
        totalResults={20}
        safePage={0}
        pageCount={2}
        onPrev={vi.fn()}
        onNext={onNext}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByText(/20/)).toBeTruthy();
    fireEvent.click(buttons[1]);
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('Overview renders top-level page audit dashboard', () => {
    const { container } = render(<Overview audit={mockAudit} />);
    expect(container.textContent).toContain('Test Title');
  });
});
