import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityEvidenceGraph } from '@/components/Charts/EntityEvidenceGraph';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import i18n from '@/i18n';

const graph = vi.hoisted(() => ({
  nodes: [
    { id: 'entity:project', kind: 'entity', label: 'Acme', provenance: 'asserted' },
    { id: 'fact:city', kind: 'fact', label: 'City', provenance: 'asserted' },
    { id: 'page:0', kind: 'page', label: 'Landing', provenance: 'measured' },
    { id: 'schema:thing', kind: 'schema', label: 'Thing', provenance: 'measured' },
  ],
  edges: [
    { id: 'missing-source', source: 'ghost', target: 'fact:city', kind: 'declared', matchedTerms: [], coverage: null, evidence: 'dangling' },
    { id: 'observed', source: 'fact:city', target: 'page:0', kind: 'observed', matchedTerms: [], coverage: undefined, evidence: 'observed' },
    { id: 'structured', source: 'page:0', target: 'schema:thing', kind: 'structured', matchedTerms: [], coverage: null, evidence: 'structured' },
  ], entityNodeId: 'entity:project', comparablePages: 1, structuredPages: 1, schemaTypes: 1,
  observedAssertions: 1, totalAssertions: 1, truncated: false,
}));

vi.mock('@/services/entityEvidenceGraph', () => ({ buildEntityEvidenceGraph: () => graph }));

describe('entity graph rendering edges', () => {
  it('handles dangling positions, undefined coverage, and nodes without details', () => {
    render(<EntityEvidenceGraph document={createEmptyTopicalMap()} pages={[]} />);
    const svg = screen.getByRole('img');
    expect(svg.querySelectorAll('circle')).toHaveLength(4);
    expect(svg.querySelectorAll('line')).toHaveLength(2);
    expect(Array.from(svg.querySelectorAll('title')).some((title) => title.textContent?.includes('—'))).toBe(true);
    expect(svg.textContent).toContain('Landing');
    fireEvent.change(screen.getByLabelText('Search entity graph'), { target: { value: 'missing' } });
    expect(screen.getByText(i18n.t('componentUi.noGraphMatches'))).toBeTruthy();
  });
});
