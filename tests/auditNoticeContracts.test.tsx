import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProblemsOnlyNotice } from '@/components/Results/ProblemsOnlyNotice';
import { Empty, Table } from '@/components/Domain/crawlResults/CrawlViewPrimitives';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { subject?: string }) => `${key}${values?.subject ? `:${values.subject}` : ''}` }) }));

describe('audit notice public contracts', () => {
  it('communicates a clean audit with its subject and no error severity', () => {
    render(<ProblemsOnlyNotice problems={[]} subject="Metadata" />);
    expect(screen.getByRole('heading').textContent).toBe('componentUi.noProblems');
    expect(screen.getByText('componentUi.noProblemsDetail:Metadata')).toBeTruthy();
    expect(screen.queryByText('componentUi.error')).toBeNull();
  });
  it('retains both finding severities and renders raw evidence as escaped text', () => {
    const evidence = '<script>unsafe()</script>';
    const { container } = render(<ProblemsOnlyNotice subject="Metadata" problems={[
      { id: 'a', label: 'Missing title', detail: 'Add a title', severity: 'error', evidence },
      { id: 'b', label: 'Long description', detail: 'Review length', severity: 'warning' },
    ]} />);
    expect(screen.getByRole('region', { name: 'componentUi.problems:Metadata' })).toBeTruthy();
    expect(screen.getByText('componentUi.error')).toBeTruthy();
    expect(screen.getByText('componentUi.warning')).toBeTruthy();
    expect(container.querySelectorAll('details')).toHaveLength(1);
    fireEvent.click(screen.getByText('schemaFindings.sourceEvidence'));
    expect(screen.getByText(evidence).textContent).toBe(evidence);
    expect(container.querySelector('script')).toBeNull();
  });
  it('renders explicit unavailable copy and semantic tables with configurable widths', () => {
    const { rerender } = render(<Empty>No measurements</Empty>);
    expect(screen.getByText('No measurements').tagName).toBe('P');
    rerender(<Table><tbody><tr><td>Measured zero</td></tr></tbody></Table>);
    expect(screen.getByRole('table').className).toContain('min-w-[760px]');
    expect(screen.getByRole('cell').textContent).toBe('Measured zero');
    rerender(<Table minWidth="min-w-[320px]"><tbody><tr><td>Compact</td></tr></tbody></Table>);
    expect(screen.getByRole('table').className).toContain('min-w-[320px]');
  });
});
