import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { CoverageMap } from '@/components/Domain/crawlResults/authority/CoverageMap';
import { DEFAULT_VIEW, statusCounts, viewRows } from '@/components/Domain/crawlResults/authority/coverageView';
import type { SubtopicCoverage, TopicalAuthorityReport } from '@/services/topicalAuthority';

const row = (subtopicId: string, pillar: string, label: string, status: SubtopicCoverage['status'], importance: number, similarity: number, urls: string[]): SubtopicCoverage =>
  ({ subtopicId, pillar, label, status, importance, similarity, urls, coverage: status === 'missing_gap' ? 0 : 1, entitiesPresent: [], entitiesMissing: [], questionsMissing: [] });
const rows = [
  row('b', 'brew', 'Pour over', 'covered_strong', 0.5, 90, ['https://x.test/Brew/pour']),
  row('a', 'brew', 'Aeropress', 'covered_shallow', 0.5, 70, ['https://x.test/brew/aero']),
  row('c', 'brew', 'Cold brew', 'missing_gap', 0.9, 0, []),
  row('d', 'gear', 'Grinders', 'cannibalized', 0.7, 95, ['https://x.test/gear/grinder', 'https://x.test/gear/mill']),
];
const report = { coverage: rows, pillarCoverage: [{ id: 'brew', label: 'brew', coveragePct: 60 }, { id: 'gear', label: 'gear', coveragePct: 40 }] } as unknown as TopicalAuthorityReport;

describe('coverage map view (#60 GEM-60-05)', () => {
  it('sorts stably with the sub-topic ID as tie-breaker', () => {
    expect(viewRows(rows, 'brew', DEFAULT_VIEW).map((item) => item.subtopicId)).toEqual(['c', 'a', 'b']);
    expect(viewRows(rows, 'brew', { ...DEFAULT_VIEW, sort: 'similarity' }).map((item) => item.subtopicId)).toEqual(['b', 'a', 'c']);
    expect(viewRows(rows, 'brew', { ...DEFAULT_VIEW, sort: 'label' }).map((item) => item.label)).toEqual(['Aeropress', 'Cold brew', 'Pour over']);
    expect(viewRows([...rows].reverse(), 'brew', DEFAULT_VIEW).map((item) => item.subtopicId)).toEqual(['c', 'a', 'b']);
  });

  it('filters by pillar, status and URL (case-insensitive); counts follow the scope', () => {
    expect(viewRows(rows, 'gear', { ...DEFAULT_VIEW, pillar: 'brew' })).toEqual([]);
    expect(viewRows(rows, 'brew', { ...DEFAULT_VIEW, url: ' brew/POUR ' }).map((item) => item.subtopicId)).toEqual(['b']);
    expect(viewRows(rows, 'brew', { ...DEFAULT_VIEW, filter: 'gaps' }).map((item) => item.subtopicId)).toEqual(['c']);
    expect(statusCounts(rows, { ...DEFAULT_VIEW, pillar: 'gear' })).toEqual({ all: 1, gaps: 0, shallow: 0, cannibalized: 1 });
    expect(statusCounts(rows, { ...DEFAULT_VIEW, url: 'mill' })).toEqual({ all: 1, gaps: 0, shallow: 0, cannibalized: 1 });
  });

  it('keeps the controlled view across drill-down and back', () => {
    const onViewChange = vi.fn();
    const onSelect = vi.fn();
    const view = render(<CoverageMap report={report} onSelect={onSelect} view={{ ...DEFAULT_VIEW, pillar: 'gear' }} onViewChange={onViewChange} />);
    expect(screen.queryByText('Pour over')).toBeNull();
    fireEvent.click(screen.getByText('Grinders'));
    expect(onSelect).toHaveBeenCalledWith('d');
    view.unmount();
    render(<CoverageMap report={report} onSelect={onSelect} view={{ ...DEFAULT_VIEW, pillar: 'gear' }} onViewChange={onViewChange} />);
    expect(screen.getByText('Grinders')).toBeTruthy();
    expect(screen.queryByText('Pour over')).toBeNull();
  });

  it('is keyboard operable and reports every change (uncontrolled works too)', () => {
    const onViewChange = vi.fn();
    render(<CoverageMap report={report} onSelect={vi.fn()} onViewChange={onViewChange} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by pillar' }), { target: { value: 'brew' } });
    expect(onViewChange).toHaveBeenLastCalledWith({ ...DEFAULT_VIEW, pillar: 'brew' });
    expect(screen.queryByText('Grinders')).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter by URL' }), { target: { value: 'aero' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort sub-topics' }), { target: { value: 'label' } });
    expect(onViewChange).toHaveBeenLastCalledWith({ filter: 'all', pillar: 'brew', url: 'aero', sort: 'label' });
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter by URL' }), { target: { value: 'nothing-here' } });
    expect(within(document.body).getByText('No sub-topics match this filter.')).toBeTruthy();
  });
});
