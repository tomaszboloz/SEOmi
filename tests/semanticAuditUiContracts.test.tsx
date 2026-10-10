import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SemanticAuditPanel } from '@/components/Charts/SemanticAuditPanel';
import { createEmptyTopicalMap } from '@/services/topicalMap';
import { buildSemanticAudit } from '@/services/semanticAudit';
import { comparisonDocument, comparisonPage } from './fixtures/semanticComparison';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import i18n from '@/i18n';

const label = (key: string, values?: Record<string, unknown>) => i18n.t(`semanticAudit.${key}`, values);

describe('semantic audit presentation controls', () => {
  it('shows measured findings, filters severity and searches evidence without inventing a score', () => {
    const document = comparisonDocument([{ id: 'query', text: 'espresso grinder' }]);
    document.entity.name = 'Coffee House';
    const pages = [comparisonPage('https://site.test/coffee', ['espresso'])];
    const report = buildSemanticAudit(document, pages);
    expect(report.findings.length).toBeGreaterThan(0);
    const view = render(<SemanticAuditPanel document={document} pages={pages} />);
    expect(view.container.querySelectorAll('li h5')).toHaveLength(report.findings.length);
    expect(screen.getByText(label('scoreNotCalculated'))).toBeTruthy();
    expect(screen.getByText(label('noBaseline'))).toBeTruthy();
    const risks = report.findings.filter((finding) => finding.severity === 'risk');
    fireEvent.click(screen.getByRole('button', { name: label('filterRisk', { count: risks.length }) }));
    expect(view.container.querySelectorAll('li h5')).toHaveLength(risks.length);
    fireEvent.click(screen.getByRole('button', { name: label('filterAll', { count: report.findings.length }) }));
    fireEvent.change(screen.getByLabelText(label('searchAria')), { target: { value: 'COFFEE' } });
    expect(view.container.querySelectorAll('li h5').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(label('searchAria')), { target: { value: 'unrelated impossible match' } });
    expect(screen.getByText(label('noFilterMatches'))).toBeTruthy();
  });

  it('defaults to the newest other run and changes baseline explicitly', () => {
    const document = comparisonDocument();
    const current = comparisonPage('https://site.test/coffee', ['coffee']);
    const newest = createCrawlRunFixture({ id: 'newest', projectId: 'semantic-project', completedAt: '2026-10-02', result: createCrawlResultFixture({ pages: [current], pages_crawled: 1 }) });
    const older = createCrawlRunFixture({ id: 'older', projectId: 'semantic-project', completedAt: '2026-10-01', result: createCrawlResultFixture({ pages: [], pages_crawled: 0 }) });
    render(<SemanticAuditPanel document={document} pages={[current]} runs={[older, newest, { ...newest, id: 'current' }]} currentRunId="current" />);
    const select = screen.getByLabelText(label('baselineRunAria')) as HTMLSelectElement;
    expect(select.value).toBe('newest');
    expect(Array.from(select.options).map((option) => option.value)).toEqual(['newest', 'older']);
    expect(screen.getByText(label('noChanges'))).toBeTruthy();
    fireEvent.change(select, { target: { value: 'older' } });
    expect(select.value).toBe('older');
    expect(screen.queryByText(label('noChanges'))).toBeNull();
    expect(screen.getAllByText('https://site.test/coffee', { selector: 'code' }).length).toBeGreaterThan(0);
  });

  it('discloses empty findings as limited evidence', () => {
    const document = createEmptyTopicalMap();
    render(<SemanticAuditPanel document={document} pages={[]} />);
    expect(screen.getByText(label('noFindings'))).toBeTruthy();
    expect(screen.getByText(label('noAuthorityProof'))).toBeTruthy();
  });
});
