import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TopicalCalendar, type TopicalCalendarFilters } from '@/components/Charts/TopicalCalendar';
import { createTopicalNode, type TopicalNode } from '@/services/topicalMap';
import i18n from '@/i18n';

const t = (k: string, o?: object) => i18n.t(k, o);
const mk = (id: string, patch: Partial<TopicalNode>): TopicalNode => ({ ...createTopicalNode(id), id, scheduledDate: '2026-09-10', ...patch });
const base: TopicalCalendarFilters = { lifecycle: 'all', kind: 'all', boundary: 'all' };
const show = (nodes: TopicalNode[], over: Partial<{ month: string; filters: TopicalCalendarFilters; search: string }> = {}) => {
  const h = { onMonthChange: vi.fn(), onFiltersChange: vi.fn(), onSearchChange: vi.fn(), onSelect: vi.fn(), onCreate: vi.fn(), onBack: vi.fn() };
  render(<TopicalCalendar nodes={nodes} month="2026-09" filters={base} search="" {...over} {...h} />);
  return h;
};
beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { vi.useRealTimers(); });

it('moves to the previous month and jumps to the current month', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 0, 15));
  const h = show([]);
  fireEvent.click(screen.getByRole('button', { name: t('topicalCalendarUi.previousMonth') }));
  expect(h.onMonthChange).toHaveBeenLastCalledWith('2026-08');
  fireEvent.click(screen.getByText(t('topicalCalendarUi.today')));
  expect(h.onMonthChange).toHaveBeenLastCalledWith('2027-01');
});

it('falls back to the current month for an invalid month key', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 2, 5));
  show([], { month: 'garbage' });
  expect(screen.getByRole('heading', { level: 5, name: new Date(2027, 2, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' }) })).toBeTruthy();
});

it('filters by kind and boundary combos and reports filter changes', () => {
  const nodes = [mk('pillar-core', { kind: 'pillar', boundary: 'core', title: 'PillarCore' }), mk('sup-outer', { kind: 'supporting', boundary: 'outer', title: 'SupOuter', scheduledDate: '' })];
  const h = show(nodes, { filters: { ...base, kind: 'pillar', boundary: 'core' } });
  expect(screen.getByText('PillarCore')).toBeTruthy();
  expect(screen.queryByText('SupOuter')).toBeNull();
  fireEvent.change(screen.getByLabelText(t('topicalCalendarUi.filterKind')), { target: { value: 'cluster' } });
  expect(h.onFiltersChange).toHaveBeenLastCalledWith({ ...base, kind: 'cluster', boundary: 'core' });
  fireEvent.change(screen.getByLabelText(t('topicalCalendarUi.filterBoundary')), { target: { value: 'outer' } });
  expect(h.onFiltersChange).toHaveBeenLastCalledWith({ ...base, kind: 'pillar', boundary: 'outer' });
});

it('hides nodes failing the lifecycle or boundary filters', () => {
  const nodes = [mk('a', { lifecycle: 'planned', boundary: 'outer', title: 'AAA' }), mk('b', { lifecycle: 'drafted', boundary: 'core', title: 'BBB' })];
  show(nodes, { filters: { ...base, lifecycle: 'drafted' } });
  expect(screen.queryByText('AAA')).toBeNull();
  expect(screen.getByText('BBB')).toBeTruthy();
});

it('searches titles and evidence terms case-insensitively and shows the empty backlog note', () => {
  const nodes = [mk('a', { title: 'Alpha', evidenceTerms: ['Espresso'] }), mk('b', { title: 'Beta', evidenceTerms: [] })];
  show(nodes, { search: '  ESPRESSO ' });
  expect(screen.getByText('Alpha')).toBeTruthy();
  expect(screen.queryByText('Beta')).toBeNull();
  expect(screen.getByText(t('topicalCalendarUi.noUnscheduled'))).toBeTruthy();
});

it('lists unscheduled topics with core and outer labels', () => {
  show([mk('a', { title: 'CoreOne', scheduledDate: '', boundary: 'core' }), mk('b', { title: 'OuterOne', scheduledDate: '', boundary: 'outer' })]);
  expect(screen.getByText(t('topicalCalendarUi.unscheduledCount', { count: 2 }))).toBeTruthy();
  expect(screen.getAllByText(t('topicalCalendarUi.core')).length).toBeGreaterThan(0);
  expect(screen.getAllByText(t('topicalCalendarUi.outer')).length).toBeGreaterThan(0);
});
