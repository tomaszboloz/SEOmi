import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicalEntityEditor } from '@/components/Charts/semanticTopical/TopicalEntityEditor';
import { EntityIdentityFields } from '@/components/Charts/semanticTopical/editor/EntityIdentityFields';
import { EntityFactForm } from '@/components/Charts/semanticTopical/editor/EntityFactForm';
import { EntityFactList } from '@/components/Charts/semanticTopical/editor/EntityFactList';
import { topicalSession } from './fixtures/topicalSessionContracts';

const facts = [
  { id: 'a', attribute: 'Location', value: 'Warsaw', sourceUrl: 'https://site.test/source', reuseStatus: 'verified' as const },
  { id: 'b', attribute: 'Unverified', value: 'Claim', sourceUrl: '', reuseStatus: 'locked' as const },
  { id: 'c', attribute: 'Source', value: 'Claim', sourceUrl: 'https://site.test/source', reuseStatus: 'locked' as const },
];

const assertIdentityEdits = (session: ReturnType<typeof topicalSession>) => {
  fireEvent.change(screen.getByLabelText('semanticWorkspace.entityLabel'), { target: { value: 'Acme' } });
  fireEvent.change(screen.getByLabelText('semanticWorkspace.contextLabel'), { target: { value: 'A verified company' } });
  expect(session.updateEntity).toHaveBeenCalledWith({ name: 'Acme' });
  expect(session.updateEntity).toHaveBeenCalledWith({ description: 'A verified company' });
  expect(screen.getByLabelText('semanticWorkspace.entityLabel').getAttribute('maxlength')).toBe('180');
};

it('updates entity identity through the public entity editor', () => {
  const session = topicalSession();
  render(<TopicalEntityEditor session={session} />);
  assertIdentityEdits(session);
});
it('updates entity identity through the extracted identity controls', () => {
  const session = topicalSession();
  render(<EntityIdentityFields session={session} />);
  assertIdentityEdits(session);
});

describe('entity fact contracts', () => {
  it('edits each draft field independently and enables addition only with nonblank content', () => {
    const session = topicalSession();
    const { rerender } = render(<EntityFactForm session={session} />);
    const button = screen.getByRole('button', { name: 'semanticWorkspace.addFact' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const entries = [['semanticWorkspace.factAttribute', 'attribute'], ['semanticWorkspace.factValue', 'value'], ['semanticWorkspace.sourceOptional', 'sourceUrl']] as const;
    for (const [label, field] of entries) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Updated' } });
      const updater = vi.mocked(session.setFactDraft).mock.calls.at(-1)![0];
      expect(typeof updater).toBe('function');
      if (typeof updater === 'function') expect(updater(session.factDraft)).toEqual({ ...session.factDraft, [field]: 'Updated' });
    }
    rerender(<EntityFactForm session={{ ...session, factDraft: { attribute: 'A', value: ' ', sourceUrl: '' } }} />);
    expect(button.disabled).toBe(true);
    rerender(<EntityFactForm session={{ ...session, factDraft: { attribute: 'A', value: 'B', sourceUrl: '' } }} />);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(session.addEntityFact).toHaveBeenCalledTimes(1);
  });
  it('requires a source for verification, retains unrelated facts and uses the latest document', () => {
    const session = topicalSession();
    session.document.entity.facts = facts;
    const { rerender } = render(<EntityFactList session={session} />);
    expect((screen.getByRole('checkbox', { name: 'semanticWorkspace.confirmFact:Unverified' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByRole('link').every((link) => link.getAttribute('rel') === 'noreferrer')).toBe(true);
    const latest = { id: 'latest', attribute: 'Latest', value: 'Saved', sourceUrl: '', reuseStatus: 'locked' as const };
    session.documentRef.current = { ...session.document, entity: { ...session.document.entity, facts: [...facts, latest] } };
    fireEvent.click(screen.getByRole('checkbox', { name: 'semanticWorkspace.confirmFact:Location' }));
    expect(session.updateEntity).toHaveBeenCalledWith({ facts: [{ ...facts[0], reuseStatus: 'locked' }, facts[1], facts[2], latest] });
    fireEvent.click(screen.getByRole('checkbox', { name: 'semanticWorkspace.confirmFact:Source' }));
    expect(session.updateEntity).toHaveBeenCalledWith({ facts: [facts[0], facts[1], { ...facts[2], reuseStatus: 'verified' }, latest] });
    fireEvent.click(screen.getByRole('button', { name: 'semanticWorkspace.removeFact:Location' }));
    expect(session.updateEntity).toHaveBeenCalledWith({ facts: [facts[1], facts[2], latest] });
    rerender(<EntityFactList session={{ ...session, document: { ...session.document, entity: { ...session.document.entity, facts: [] } } }} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
