import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SemanticWorkspaceHeader } from '@/components/Charts/semanticTopical/SemanticWorkspaceHeader';
import { SemanticWorkspaceNav } from '@/components/Charts/semanticTopical/SemanticWorkspaceNav';
import { maxLocReport } from '../scripts/check-max-loc.mjs';

const mockT = ((key: string, opts?: any) => {
  if (opts && typeof opts === 'object') {
    return `${key} ${JSON.stringify(opts)}`;
  }
  return key;
}) as any;

describe('SemanticTopicalWorkspace modular components', () => {
  it('satisfies physical LOC <= 150 across decomposed workspace files', () => {
    const files = [
      'src/components/Charts/SemanticTopicalWorkspace.tsx',
      'src/components/Charts/semanticTopical/SemanticWorkspaceHeader.tsx',
      'src/components/Charts/semanticTopical/SemanticWorkspaceNav.tsx',
      'src/components/Charts/semanticTopical/SemanticWorkspacePanels.tsx',
    ];
    const report = maxLocReport(files);
    expect(report.violations).toEqual([]);
  });

  it('renders SemanticWorkspaceHeader with core and outer metric values', () => {
    const doc = {
      nodes: [
        { id: '1', label: 'Topic A', boundary: 'core' },
        { id: '2', label: 'Topic B', boundary: 'outer' },
        { id: '3', label: 'Topic C', boundary: 'core' },
      ],
    } as any;

    render(
      <SemanticWorkspaceHeader
        document={doc}
        assignedUrlCount={5}
        t={mockT}
      />,
    );

    expect(screen.getByText('semanticWorkspace.title')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined(); // core count
    expect(screen.getByText('1')).toBeDefined(); // outer count
    expect(screen.getByText('5')).toBeDefined(); // assigned url count
  });

  it('renders SemanticWorkspaceNav and switches view on click', () => {
    const onSelectView = vi.fn();

    render(
      <SemanticWorkspaceNav
        currentView="topics"
        onSelectView={onSelectView}
        t={mockT}
      />,
    );

    const calendarTab = screen.getByRole('tab', { name: 'semanticWorkspace.tabCalendar' });
    expect(calendarTab).toBeDefined();
    fireEvent.click(calendarTab);
    expect(onSelectView).toHaveBeenCalledWith('calendar');
  });
});
