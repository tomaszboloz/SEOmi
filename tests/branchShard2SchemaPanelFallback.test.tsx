import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { SemanticWorkspacePanels } from '@/components/Charts/semanticTopical/SemanticWorkspacePanels';
import type { useSemanticTopicalSession } from '@/components/Charts/semanticTopical/useSemanticTopicalSession';
import { createEmptyTopicalMap } from '@/services/topicalMap';

vi.mock('@/components/Charts/SchemaGraphBuilder', () => ({
  SchemaGraphBuilder: ({ siteUrl }: { siteUrl: string }) => <div data-testid="schema-panel">{`site:[${siteUrl}]`}</div>,
}));

type Session = ReturnType<typeof useSemanticTopicalSession>;

it('passes an empty site URL to the schema builder when no crawled page exists', () => {
  const session = {
    addNodeOnDate: vi.fn(), currentRunId: 'run', document: createEmptyTopicalMap(), pages: [], runs: [], selectedNode: null,
    setSelectedId: vi.fn(), t: (key: string) => key, updateWorkspacePreferences: vi.fn(),
    workspacePreferences: {
      view: 'schema', month: '2026-10', filters: { lifecycle: 'all', kind: 'all', boundary: 'all' }, search: '',
      schemaUrl: '', includeSchemaOrganization: true, includeSchemaBreadcrumbs: false, schemaArticleType: '',
    },
  } as unknown as Session;
  render(<SemanticWorkspacePanels session={session} />);
  expect(screen.getByTestId('schema-panel').textContent).toBe('site:[]');
});
