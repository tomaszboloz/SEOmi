import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { InternalLinkOpportunitiesPanel } from '@/components/Charts/InternalLinkOpportunitiesPanel';

vi.mock('@/services/internalLinkOpportunities', () => ({
  findInternalLinkOpportunities: () => ({
    opportunities: [], eligiblePageCount: 4, pagesWithoutCompleteEvidence: 0, pagesOmittedByLimit: 7, resultsLimited: true,
  }),
}));

afterEach(cleanup);

it('lists omitted candidates and the 500-result ceiling in the partial-result notice', () => {
  render(<InternalLinkOpportunitiesPanel pages={[]} />);
  const status = screen.getByRole('status');
  const candidates = i18n.t('componentUi.candidates');
  expect(status.textContent).toContain(`7 ${candidates.toLocaleLowerCase()}; `.trim());
  expect(status.textContent).toContain(`${candidates} ≤ 500;`);
  expect(status.textContent).not.toContain(`0 ${i18n.t('componentUi.noCompletePages').toLocaleLowerCase()}`);
});
