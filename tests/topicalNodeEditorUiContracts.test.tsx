import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopicalNodeEditor } from '@/components/Charts/semanticTopical/TopicalNodeEditor';
import type { TopicalNode, TopicalContentBrief } from '@/services/topicalMap';
import { createTopicalNode } from '@/services/topicalMap';
import { topicalSession } from './fixtures/topicalSessionContracts';

vi.mock('@/components/Charts/semanticTopical/TopicalNodeMetadata', () => ({ TopicalNodeMetadata: () => null }));
vi.mock('@/components/Charts/semanticTopical/TopicalQueryEvidenceEditor', () => ({ TopicalQueryEvidenceEditor: () => null }));
vi.mock('@/components/Charts/semanticTopical/TopicalUrlAssignments', () => ({ TopicalUrlAssignments: () => null }));
vi.mock('@/components/Charts/semanticTopical/TopicalCrawlEvidence', () => ({ TopicalCrawlEvidence: () => null }));
vi.mock('@/components/Charts/ContentBriefEditor', () => ({ ContentBriefEditor: ({ node, onUpdate, onAdvance }: {
  node: TopicalNode; onUpdate: (brief: TopicalContentBrief) => void; onAdvance: () => void;
}) => <><button onClick={() => onUpdate({ ...node.contentBrief, draftMarkdown: 'Updated draft' })}>Update brief</button>
  <button onClick={onAdvance}>Advance draft</button></> }));
afterEach(() => vi.restoreAllMocks());

describe('topical node editor orchestration', () => {
  it('has no editor without a selected topic and forwards brief changes for that topic', () => {
    const { container, rerender } = render(<TopicalNodeEditor session={topicalSession({ selectedNode: null })} />);
    expect(container.textContent).toBe('');
    const session = topicalSession();
    rerender(<TopicalNodeEditor session={session} />);
    fireEvent.click(screen.getByRole('button', { name: 'Update brief' }));
    fireEvent.click(screen.getByRole('button', { name: 'Advance draft' }));
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { contentBrief: { ...session.selectedNode!.contentBrief, draftMarkdown: 'Updated draft' } });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { lifecycle: 'drafted' });
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('retains the topic when deletion is cancelled and detaches children from the latest document on confirmation', () => {
    const session = topicalSession();
    const child = { ...createTopicalNode('Child'), id: 'child', parentId: 'coffee' };
    const other = { ...createTopicalNode('Other'), id: 'other' };
    const latest = { ...createTopicalNode('Latest'), id: 'latest' };
    session.document.nodes = [session.selectedNode!, child, other];
    session.documentRef.current = { ...session.document, nodes: [...session.document.nodes, latest] };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<TopicalNodeEditor session={session} />);
    const button = screen.getByRole('button', { name: 'semanticWorkspace.removeTopic' });
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledWith('semanticWorkspace.confirmDeleteTopic:Coffee');
    expect(session.persist).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(button);
    expect(session.persist).toHaveBeenCalledWith({ ...session.documentRef.current, nodes: [{ ...child, parentId: null }, other, latest] });
    expect(session.setSelectedId).toHaveBeenCalledWith(null);
  });
  it('toggles a lateral relationship symmetrically against current saved data', () => {
    const session = topicalSession();
    const other = { ...createTopicalNode('Other'), id: 'other' };
    session.document.nodes.push(other);
    render(<TopicalNodeEditor session={session} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Other' }));
    expect(session.persist).toHaveBeenCalledWith({ ...session.document, nodes: [
      { ...session.selectedNode!, relatedNodeIds: ['other'] }, { ...other, relatedNodeIds: ['coffee'] },
    ] });
  });
});
