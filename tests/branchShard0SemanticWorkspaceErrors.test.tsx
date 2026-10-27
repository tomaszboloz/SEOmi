import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import type { Props } from '@/components/Charts/semanticTopical/contracts';

vi.mock('@/components/Charts/semanticTopical/useSemanticTopicalSession', () => ({
  useSemanticTopicalSession: () => ({
    assignedUrlCount: 0,
    document: { nodes: [] },
    preferencesSaveError: true,
    saveError: true,
    t: (key: string) => key,
    updateWorkspacePreferences: () => undefined,
    workspacePreferences: { view: 'audit' },
  }),
}));
vi.mock('@/components/Charts/semanticTopical/SemanticWorkspaceHeader', () => ({ SemanticWorkspaceHeader: () => null }));
vi.mock('@/components/Charts/semanticTopical/SemanticWorkspaceNav', () => ({ SemanticWorkspaceNav: () => null }));
vi.mock('@/components/Charts/semanticTopical/SemanticWorkspacePanels', () => ({ SemanticWorkspacePanels: () => null }));
vi.mock('@/components/Charts/semanticTopical/TopicalEntityEditor', () => ({ TopicalEntityEditor: () => <div data-testid="editor" /> }));

afterEach(cleanup);

it('announces both persistence failures and hides the entity editor in the audit view', () => {
  render(<SemanticTopicalWorkspace {...({ projectId: 'shard0-project' } as unknown as Props)} />);
  const alerts = screen.getAllByRole('alert').map((node) => node.textContent);
  expect(alerts).toEqual(['semanticWorkspace.saveError', 'semanticWorkspace.preferencesSaveError']);
  expect(screen.queryByTestId('editor')).toBeNull();
});
