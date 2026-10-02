import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EntityEvidenceGraph } from '@/components/Charts/EntityEvidenceGraph';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { createCrawlPageFixture as page } from './fixtures/crawl';
import i18n from '@/i18n';

const label = (key: string, values?: Record<string, unknown>) => i18n.t(`componentUi.${key}`, values);

describe('entity evidence graph controls', () => {
  it('does not invent an entity graph when the owner has not declared an entity', () => {
    render(<EntityEvidenceGraph document={createEmptyTopicalMap()} pages={[]} />);
    expect(screen.getByText(label('entityGraphEmpty'))).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('renders declared, lexical, structured and reference evidence and filters visible graph nodes', () => {
    const document = createEmptyTopicalMap();
    document.entity = { name: 'Acme SEO', description: 'Owner declaration', facts: [{ id: 'city', attribute: 'City', value: 'Warszawa', sourceUrl: 'https://site.test/about', reuseStatus: 'verified' }] };
    const pages = [page({ url: 'https://site.test/about', final_url: 'https://site.test/about', title: 'About Warsaw', semantic_terms: ['acme', 'seo', 'warszawa'], schema_types: ['Organization'], schema_references: [{ format: 'JSON-LD', declaration_index: 1, property: '@id', value: 'https://site.test/#organization' }] })];
    const view = render(<EntityEvidenceGraph document={document} pages={pages} />);
    const svg = screen.getByRole('img', { name: `${label('entityGraph')} Acme SEO` });
    expect(svg.querySelectorAll('line')).toHaveLength(6);
    expect(svg.textContent).toContain('Organization');
    expect(svg.textContent).toContain('@id: https://site.test/#organization');
    for (const key of ['declaredEdge', 'observedEdge', 'structuredEdge', 'referenceEdge']) expect(screen.getByText(label(key))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label('searchEntityGraph')), { target: { value: '  WARSZAWA  ' } });
    expect(svg.textContent).toContain('Warszawa');
    expect(screen.getByText(label('noGraphMatches'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label('searchEntityGraph')), { target: { value: 'Organization' } });
    expect(svg.textContent).toContain('Organization');
    fireEvent.change(screen.getByLabelText(label('searchEntityGraph')), { target: { value: 'not present' } });
    expect(svg.querySelectorAll('circle')).toHaveLength(1);
    expect(svg.querySelectorAll('line')).toHaveLength(0);
    expect(view.container.textContent).toContain(label('noGraphMatches'));
  });

  it('caps visible facts/pages and discloses a source graph that exceeded its input budget', () => {
    const document = createEmptyTopicalMap();
    document.entity.name = 'Acme';
    document.entity.facts = Array.from({ length: 31 }, (_, i) => ({ id: `fact${i}`, attribute: `Location ${i}`, value: 'city', sourceUrl: '', reuseStatus: 'locked' as const }));
    const pages = Array.from({ length: 501 }, (_, i) => page({ url: `https://site.test/${i}`, final_url: `https://site.test/${i}`, title: `Page ${i}`, semantic_terms: ['acme', 'city'] }));
    render(<EntityEvidenceGraph document={document} pages={pages} />);
    expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(65);
    expect(screen.getByRole('status').textContent).toBe(label('graphLimited'));
    expect(screen.getByText(label('shownLimits', { facts: 28, pages: 36 }))).toBeTruthy();
  });
});
