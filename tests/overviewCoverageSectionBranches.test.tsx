import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { OverviewCoverageSection } from '@/components/Results/overview/OverviewCoverageSection';
import { useAuditStore } from '@/stores/auditStore';
import type { PageAuditData } from '@/types';

const mocks = vi.hoisted(() => ({ checks: [] as unknown[], copyText: vi.fn() }));
vi.mock('@/services/auditChecks', () => ({ buildLocalAuditChecks: () => mocks.checks }));
vi.mock('@/services/clipboard', () => ({ copyText: mocks.copyText }));

const make = (n: number, status: string, category: string, from = 0) => Array.from({ length: n }, (_, i) =>
  ({ id: `${status}-${from + i}`, label: `Label ${status} ${from + i}`, category, status, evidence: `ev ${status} ${from + i}`, severity: 'low' }));
const audit = {} as PageAuditData;
const t = (k: string) => i18n.t(k);
beforeEach(async () => {
  await i18n.changeLanguage('en');
  mocks.copyText.mockReset().mockResolvedValue(true);
  mocks.checks = [...make(30, 'pass', 'seo'), ...make(1, 'warning', 'links'), ...make(1, 'error', 'media'), ...make(1, 'not_applicable', 'media')];
});
afterEach(() => { useAuditStore.setState({ showOnlyProblems: false }); });

it('paginates 24 per page and clamps previous and next at the edges', () => {
  render(<OverviewCoverageSection audit={audit} />);
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(24);
  const next = screen.getByRole('button', { name: t('legacyUi.overview.next') });
  const prev = screen.getByRole('button', { name: t('legacyUi.overview.previous') });
  expect(prev.disabled).toBe(true);
  fireEvent.click(next);
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(9);
  expect(next.disabled).toBe(true);
  fireEvent.click(prev);
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(24);
});

it('filters by status, category, query and problems-only, showing empty state', () => {
  render(<OverviewCoverageSection audit={audit} />);
  const [statusSel, categorySel] = screen.getAllByRole('combobox');
  fireEvent.change(statusSel, { target: { value: 'warning' } });
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(1);
  fireEvent.change(statusSel, { target: { value: 'all' } });
  fireEvent.change(categorySel, { target: { value: 'media' } });
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(2);
  const search = screen.getByPlaceholderText(t('legacyUi.overview.searchPlaceholder'));
  fireEvent.change(search, { target: { value: '  EV ERROR ' } });
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(1);
  fireEvent.change(search, { target: { value: 'zzz-none' } });
  expect(screen.getByText(t('legacyUi.overview.noMatchingChecks'))).toBeTruthy();
  expect((screen.getByRole('button', { name: t('legacyUi.overview.copyChecks') }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.change(categorySel, { target: { value: 'all' } });
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getAllByTitle(/^Label /)).toHaveLength(2);
});

it('copies filtered checks and reports success then failure', async () => {
  render(<OverviewCoverageSection audit={audit} />);
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'error' } });
  const btn = screen.getByRole('button', { name: t('legacyUi.overview.copyChecks') });
  fireEvent.click(btn);
  expect(mocks.copyText).toHaveBeenCalledWith('[error] media · Label error 0\nev error 0');
  await waitFor(() => expect(btn.textContent).toContain(t('legacyUi.overview.copied')));
  mocks.copyText.mockResolvedValue(false);
  fireEvent.click(btn);
  await waitFor(() => expect(btn.textContent).toContain(t('legacyUi.overview.copyFailed')));
});
