import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { IgosPanel } from '@/components/Results/igos/IgosPanel';
import { normalize } from '@/services/embeddings/vector';
import { buildBaseline } from '@/services/igos/baseline';
import { baseCoverage, missingBasics } from '@/services/igos/components';
import { evidenceAdvice } from '@/services/igos/heatmap';
import { buildIgosReport } from '@/services/igos/report';
import type { CompetitorDoc, TargetDoc } from '@/services/igos/types';

const vec = normalize([1, 0]);
const doc = (rank: number, entities: string[]): CompetitorDoc => ({ url: `https://c${rank}.test/`, rank, fetchedAt: null, status: 200, entities, passages: [{ text: 'p', vector: vec }], terms: new Map([['a', 1]]) });
const target = (entities: string[]): TargetDoc => ({ url: 'https://t.test/', entities, wordCount: 100, terms: new Map([['a', 1]]), chunks: [{ text: 'We tested it. 10 kg.', offset: 0, heading: null, vector: vec }] });
const docs = [doc(1, ['Brew Ratio', 'Grind']), doc(2, ['Brew Ratio', 'Grind']), doc(3, ['Brew Ratio', 'Water'])];
const baseline = buildBaseline(docs, 3);

describe('IGOS missing basics (#67 GEM-67-10, #68)', () => {
  it('lists consensus entities the page lacks; aliases match; coverage is their complement', () => {
    expect(missingBasics(target(['brew ratio ']), baseline)).toEqual(['Grind']);
    expect(baseCoverage(target(['brew ratio ']), baseline)).toBe(0.5);
    expect(missingBasics(target(['Brew Ratio', 'Grind']), baseline)).toEqual([]);
    expect(baseCoverage(target([]), buildBaseline([doc(1, [])], 1))).toBe(1);
  });

  it('carries missing basics on the report, advises adding them first, and the panel shows them', () => {
    const report = buildIgosReport(target([]), docs, baseline);
    expect(report.missingBasics).toEqual(['Brew Ratio', 'Grind']);
    expect(report.multiplier).toBe(0.5);
    expect(evidenceAdvice(report).map((item) => item.kind)).toContain('add-basics');
    render(<IgosPanel report={report} />);
    expect(screen.getByTestId('igos-missing-basics').textContent).toBe('Basics most TOP pages cover but this page does not: Brew Ratio, Grind');
    expect(screen.getByText(/Cover the 2 missing basic topic\(s\) first/)).toBeTruthy();
  });

  it('gives no basics advice when nothing is missing or the field is absent', () => {
    expect(evidenceAdvice({ ...buildIgosReport(target(['Brew Ratio', 'Grind']), docs, baseline) }).map((item) => item.kind)).not.toContain('add-basics');
    expect(evidenceAdvice({ ...buildIgosReport(target([]), docs, baseline), missingBasics: undefined }).map((item) => item.kind)).not.toContain('add-basics');
  });
});
