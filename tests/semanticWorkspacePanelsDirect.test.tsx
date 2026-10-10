import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SemanticWorkspacePanels } from '@/components/Charts/semanticTopical/SemanticWorkspacePanels';
import type { useSemanticTopicalSession } from '@/components/Charts/semanticTopical/useSemanticTopicalSession';
import type { TopicalWorkspacePreferences, TopicalWorkspaceView } from '@/components/Charts/semanticTopical/workspaceHelpers';
import { createEmptyTopicalMap } from '@/services/topicalMap';

vi.mock('@/components/Charts/SemanticAuditPanel', () => ({
  SemanticAuditPanel: ({ currentRunId }: { currentRunId?: string }) => <div data-testid="audit-panel">audit:{currentRunId}</div>,
}));
vi.mock('@/components/Charts/EntityEvidenceGraph', () => ({
  EntityEvidenceGraph: ({ pages }: { pages: unknown[] }) => <div data-testid="entity-panel">entity:{pages.length}</div>,
}));
vi.mock('@/components/Charts/SchemaGraphBuilder', () => ({
  SchemaGraphBuilder: (props: any) => <div data-testid="schema-panel">
    <span>{`${props.siteUrl}|${props.selectedUrl}|${props.includeOrganization}|${props.includeUrlBreadcrumbs}|${props.articleType}`}</span>
    <button onClick={() => props.onSelectedUrlChange('https://selected.test/')}>schema-url</button>
    <button onClick={() => props.onIncludeOrganizationChange(false)}>schema-org</button>
    <button onClick={() => props.onIncludeUrlBreadcrumbsChange(true)}>schema-breadcrumbs</button>
    <button onClick={() => props.onArticleTypeChange('Article')}>schema-type</button>
  </div>,
}));
vi.mock('@/components/Charts/InternalLinkOpportunitiesPanel', () => ({
  InternalLinkOpportunitiesPanel: ({ pages }: { pages: unknown[] }) => <div data-testid="links-panel">links:{pages.length}</div>,
}));
vi.mock('@/components/Charts/TopicalCalendar', () => ({
  TopicalCalendar: (props: any) => <div data-testid="calendar-panel">
    <button onClick={() => props.onMonthChange('2026-11')}>calendar-month</button>
    <button onClick={() => props.onFiltersChange({ lifecycle: 'published', kind: 'pillar', boundary: 'core' })}>calendar-filters</button>
    <button onClick={() => props.onSearchChange('needle')}>calendar-search</button>
    <button onClick={() => props.onSelect('topic-2')}>calendar-select</button>
    <button onClick={() => props.onCreate('2026-10-05')}>calendar-create</button>
    <button onClick={props.onBack}>calendar-back</button>
  </div>,
}));
vi.mock('@/components/Charts/semanticTopical/TopicalTopicBrowser', () => ({
  TopicalTopicBrowser: () => <div data-testid="topics-panel">topics</div>,
}));
vi.mock('@/components/Charts/semanticTopical/TopicalNodeEditor', () => ({
  TopicalNodeEditor: () => <div data-testid="editor-panel">editor</div>,
}));

type Session = ReturnType<typeof useSemanticTopicalSession>;
const preferences = (view: TopicalWorkspaceView): TopicalWorkspacePreferences => ({
  view, month: '2026-10', filters: { lifecycle: 'all', kind: 'all', boundary: 'all' }, search: 'seed',
  schemaUrl: 'https://selected.test/', includeSchemaOrganization: true, includeSchemaBreadcrumbs: false, schemaArticleType: '',
});
const session = (view: TopicalWorkspaceView, overrides: Partial<Session> = {}) => ({
  addNodeOnDate: vi.fn(), currentRunId: 'current-run', document: createEmptyTopicalMap(), pages: [{ url: 'https://site.test/' }], runs: [], selectedNode: null,
  setSelectedId: vi.fn(), t: (key: string) => key, updateWorkspacePreferences: vi.fn(), workspacePreferences: preferences(view), ...overrides,
} as unknown as Session);

describe('SemanticWorkspacePanels direct view contracts', () => {
  it('routes audit, entity, and links views to their dedicated panels', () => {
    const view = render(<SemanticWorkspacePanels session={session('audit')} />);
    expect(screen.getByTestId('audit-panel').textContent).toContain('current-run');
    view.rerender(<SemanticWorkspacePanels session={session('entity')} />);
    expect(screen.getByTestId('entity-panel').textContent).toBe('entity:1');
    view.rerender(<SemanticWorkspacePanels session={session('links')} />);
    expect(screen.getByTestId('links-panel').textContent).toBe('links:1');
  });

  it('passes schema state and wraps each schema preference callback', () => {
    const current = session('schema');
    render(<SemanticWorkspacePanels session={current} />);
    expect(screen.getByTestId('schema-panel').textContent).toContain('https://site.test/|https://selected.test/|true|false|');
    fireEvent.click(screen.getByRole('button', { name: 'schema-url' }));
    fireEvent.click(screen.getByRole('button', { name: 'schema-org' }));
    fireEvent.click(screen.getByRole('button', { name: 'schema-breadcrumbs' }));
    fireEvent.click(screen.getByRole('button', { name: 'schema-type' }));
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(1, { schemaUrl: 'https://selected.test/' });
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(2, { includeSchemaOrganization: false });
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(3, { includeSchemaBreadcrumbs: true });
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(4, { schemaArticleType: 'Article' });
  });

  it('wraps calendar navigation callbacks and shows topic selection states', () => {
    const current = session('calendar');
    render(<SemanticWorkspacePanels session={current} />);
    for (const name of ['calendar-month', 'calendar-filters', 'calendar-search', 'calendar-select', 'calendar-create', 'calendar-back']) fireEvent.click(screen.getByRole('button', { name }));
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(1, { month: '2026-11' });
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(2, { filters: { lifecycle: 'published', kind: 'pillar', boundary: 'core' } });
    expect(current.updateWorkspacePreferences).toHaveBeenNthCalledWith(3, { search: 'needle' });
    expect(current.setSelectedId).toHaveBeenCalledWith('topic-2');
    expect(current.updateWorkspacePreferences).toHaveBeenCalledWith({ view: 'topics' });
    expect(current.addNodeOnDate).toHaveBeenCalledWith('2026-10-05');

    const topics = session('topics');
    const view = render(<SemanticWorkspacePanels session={topics} />);
    expect(screen.getByTestId('topics-panel')).toBeTruthy();
    expect(screen.getByText('semanticWorkspace.selectTopic')).toBeTruthy();
    view.rerender(<SemanticWorkspacePanels session={session('topics', { selectedNode: { id: 'topic-1' } as never })} />);
    expect(screen.getByTestId('editor-panel')).toBeTruthy();
  });
});
