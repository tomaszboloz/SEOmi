import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { IgosPanel } from '@/components/Results/igos/IgosPanel';
import type { IgosReport } from '@/services/igos/report';
import type { ChunkZone } from '@/services/igos/types';

const zone = (offset: number, kind: ChunkZone, heading: string | null) => ({
  chunk: { text: `Paragraph ${offset}`, offset, heading, vector: new Float64Array([1, 0]) },
  topic: 0.5, nearest: 0.7, zone: kind,
  evidence: kind === 'echo' ? { url: 'https://c1.test/', rank: 1, passageIndex: 0 } : null,
});

const report = (patch: Partial<IgosReport> = {}): IgosReport => ({
  status: 'ready', igos: 61, components: { nefr: 0.5, edsi: 0, fhem: 0.2, sdd: 0.9 }, coverage: 0.4, multiplier: 0.9,
  onTopicShare: 0.8, availableDocs: 8, requestedDocs: 10, novelEntities: ['Alpha'], limitations: [],
  zones: [zone(0, 'echo', 'H2 A'), zone(10, 'gain', 'H2 A'), zone(20, 'drift', 'H2 B'), zone(30, 'neutral', null)], ...patch,
});

describe('IgosPanel', () => {
  it('shows empty state without a report or baseline', () => {
    const { rerender } = render(<IgosPanel report={null} />);
    expect(screen.getByText(/no baseline and no score/i)).toBeTruthy();
    rerender(<IgosPanel report={report({ status: 'unavailable', igos: null, limitations: ['no-comparable-documents', 'custom'] })} />);
    expect(screen.getByText(/No comparable competitor documents/)).toBeTruthy();
    expect(screen.getByText('custom')).toBeTruthy();
  });

  it('renders score, components, coverage, text zone labels and recommendations', () => {
    render(<IgosPanel report={report({ status: 'partial', limitations: ['some-documents-missing'] })} />);
    expect(screen.getByText('61')).toBeTruthy();
    expect(screen.getByText(/Partial baseline: 8 of 10/)).toBeTruthy();
    expect(screen.getByText(/Baseline coverage 40%, penalty multiplier 0.90/)).toBeTruthy();
    expect(screen.getByText(/New on-topic entities: Alpha/)).toBeTruthy();
    for (const label of ['Echo', 'Gain', 'Drift', 'Neutral']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('No heading', { selector: 'h5' })).toBeTruthy();
    expect(screen.getByText(/rewrite it in your own words/)).toBeTruthy();
    expect(screen.getByText(/none was detected/)).toBeTruthy();
    expect(screen.getByText(/drifts off the topic/)).toBeTruthy();
  });

  it('shows ready basis, off-topic without a score, and empty heatmap', () => {
    const { rerender } = render(<IgosPanel report={report()} />);
    expect(screen.getByText(/^Baseline: 8 of 10/)).toBeTruthy();
    rerender(<IgosPanel report={report({ status: 'off-topic', igos: null, components: null, coverage: null, multiplier: null, novelEntities: [], zones: [] })} />);
    expect(screen.getByText('No score')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toMatch(/off-topic/);
    expect(screen.getByText('No paragraphs to show.')).toBeTruthy();
  });

  it('supports keyboard navigation and drill-down to the nearest source', () => {
    render(<IgosPanel report={report()} />);
    const cells = screen.getAllByRole('button', { name: /^(Echo|Gain|Drift|Neutral)/i });
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cells[1]);
    fireEvent.keyDown(cells[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(cells[0]);
    fireEvent.keyDown(cells[0], { key: 'ArrowUp' });
    fireEvent.keyDown(cells[3], { key: 'ArrowDown' });
    fireEvent.keyDown(cells[0], { key: 'Enter' });
    expect(document.activeElement).toBe(cells[0]);
    fireEvent.click(cells[0]);
    expect(screen.getByRole('status').textContent).toMatch(/c1\.test.*rank 1/);
    fireEvent.click(cells[1]);
    expect(screen.getByRole('status').textContent).toMatch(/No nearest source/);
  });
});
