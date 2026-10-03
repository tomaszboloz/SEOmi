import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TopicalNodeMetadata } from '@/components/Charts/semanticTopical/TopicalNodeMetadata';
import { NodeIdentityFields } from '@/components/Charts/semanticTopical/editor/NodeIdentityFields';
import { NodeLifecycleFields } from '@/components/Charts/semanticTopical/editor/NodeLifecycleFields';
import { createTopicalNode } from '@/services/topicalMap';
import { assessContentBrief } from '@/services/contentBrief';
import { topicalSession } from './fixtures/topicalSessionContracts';

const assertIdentityEdits = (session: ReturnType<typeof topicalSession>) => {
  const edits = [['semanticWorkspace.name', 'New title', 'title'], ['semanticWorkspace.type', 'pillar', 'kind'],
    ['semanticWorkspace.scope', 'outer', 'boundary'], ['semanticWorkspace.intentLabel', 'commercial', 'intent']] as const;
  for (const [label, value, field] of edits) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { [field]: value });
  }
};

it('updates title, type, scope and intent through the public metadata editor', () => {
  const session = topicalSession();
  const { rerender } = render(<TopicalNodeMetadata session={session} />);
  assertIdentityEdits(session);
  rerender(<TopicalNodeMetadata session={{ ...session, selectedNode: null }} />);
  expect(screen.queryByLabelText('semanticWorkspace.name')).toBeNull();
});
it('updates title, type, scope and intent through the extracted identity fields', () => {
  const session = topicalSession();
  const { rerender } = render(<NodeIdentityFields session={session} />);
  assertIdentityEdits(session);
  rerender(<NodeIdentityFields session={{ ...session, selectedNode: null }} />);
  expect(screen.queryByLabelText('semanticWorkspace.name')).toBeNull();
});

describe('topical lifecycle controls', () => {
  it('blocks brief/draft transitions until their respective readiness checks pass', () => {
    const session = topicalSession();
    const { rerender } = render(<NodeLifecycleFields session={session} />);
    const select = screen.getByLabelText('semanticWorkspace.lifecycleLabel');
    expect((screen.getByRole('option', { name: 'Briefed' }) as HTMLOptionElement).disabled).toBe(true);
    expect((screen.getByRole('option', { name: 'Drafted' }) as HTMLOptionElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: 'briefed' } });
    fireEvent.change(select, { target: { value: 'drafted' } });
    expect(session.updateNode).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'published' } });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { lifecycle: 'published' });
    const assessment = assessContentBrief(session.selectedNode!, session.selectedNode!.contentBrief, [], []);
    rerender(<NodeLifecycleFields session={{ ...session, selectedBriefAssessment: { ...assessment, readyForBrief: true, readyToAdvance: true } }} />);
    expect((screen.getByRole('option', { name: 'Briefed' }) as HTMLOptionElement).disabled).toBe(false);
    fireEvent.change(select, { target: { value: 'briefed' } });
    fireEvent.change(select, { target: { value: 'drafted' } });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { lifecycle: 'briefed' });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { lifecycle: 'drafted' });
  });
  it('edits publish dates and chooses only other topics as parents', () => {
    const session = topicalSession();
    const other = { ...createTopicalNode('Parent'), id: 'parent' };
    session.document.nodes.push(other);
    session.selectedNode!.parentId = other.id;
    const { rerender } = render(<NodeLifecycleFields session={session} />);
    fireEvent.change(screen.getByLabelText('semanticWorkspace.publishDate'), { target: { value: '2026-12-01' } });
    expect(session.updateNode).toHaveBeenCalledWith('coffee', { scheduledDate: '2026-12-01' });
    const parent = screen.getByLabelText('semanticWorkspace.parentTopic');
    expect(screen.queryByRole('option', { name: 'Coffee' })).toBeNull();
    fireEvent.change(parent, { target: { value: '' } });
    fireEvent.change(parent, { target: { value: 'parent' } });
    expect(session.moveTopicalNode).toHaveBeenCalledWith('coffee', null);
    expect(session.moveTopicalNode).toHaveBeenCalledWith('coffee', 'parent');
    rerender(<NodeLifecycleFields session={{ ...session, selectedNode: null }} />);
    expect(screen.queryByLabelText('semanticWorkspace.publishDate')).toBeNull();
  });
});
