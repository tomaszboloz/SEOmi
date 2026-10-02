import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefBasics } from '@/components/Charts/contentBrief/BriefBasics';
import { BriefFacts } from '@/components/Charts/contentBrief/BriefFacts';
import { ContentBriefEditor } from '@/components/Charts/ContentBriefEditor';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import { briefLabel as label, briefModel, briefProps } from './fixtures/briefUiContracts';
import { fact } from './fixtures/contentBriefContracts';

describe('brief basics and fact controls', () => {
  it('updates target query, answer format and deduplicated bounded required entities', () => {
    const model = briefModel();
    model.node.queries = [{ id: 'q', text: 'Coffee guide', provenance: 'asserted' }];
    render(<BriefBasics model={model} />);
    fireEvent.change(screen.getByLabelText(label('targetQueryAria')), { target: { value: 'q' } });
    expect(model.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ targetQueryId: 'q' }));
    fireEvent.change(screen.getByLabelText(label('snippetAria')), { target: { value: 'faq' } });
    expect(model.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ snippetTarget: 'faq' }));
    const values = Array.from({ length: 81 }, (_, i) => `concept${i}`);
    fireEvent.change(screen.getByLabelText(label('requiredAria')), { target: { value: ` \n${values.join('\n')}\n concept0 \n` } });
    expect(model.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ requiredEntities: values.slice(0, 80) }));
  });

  it('reports missing query and required concepts', () => {
    const props = briefProps();
    props.node.contentBrief.requiredEntities = ['grinder'];
    render(<BriefBasics model={createBriefModel(props)} />);
    expect(screen.getByText(label('addQuery')).textContent).toBe(label('addQuery'));
    expect(screen.getByText(label('missingInDraft', { items: 'grinder' })).textContent).toContain('grinder');
  });

  it('labels sourced verified facts, unsourced facts and locked draft reuse distinctly', () => {
    const props = briefProps({ facts: [fact('approved', 'verified', 'https://site.test/fact'), fact('unsourced', 'verified'), fact('locked value', 'locked', 'https://site.test/locked')] });
    props.node.contentBrief.draftMarkdown = 'locked value';
    render(<BriefFacts model={createBriefModel(props)} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByRole('alert').textContent).toContain('locked value');
    expect(screen.getByText(label('verified')).textContent).toBe(label('verified'));
    expect(screen.getAllByText(label('locked'))).toHaveLength(2);
    expect(screen.getByText(label('approvedSources', { count: 1 })).textContent).toContain('1');
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['https://site.test/fact', 'https://site.test/locked']);
  });

  it('discloses empty fact state', () => {
    render(<BriefFacts model={briefModel()} />);
    expect(screen.getByText(label('noFacts')).textContent).toBe(label('noFacts'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('edits the draft and advances only when its explicit readiness gate passes', () => {
    const props = briefProps();
    const view = render(<ContentBriefEditor {...props} />);
    fireEvent.change(screen.getByLabelText(label('draftAria')), { target: { value: 'Coffee guide' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ draftMarkdown: 'Coffee guide' }));
    expect((screen.getByRole('button', { name: label('markDraft') }) as HTMLButtonElement).disabled).toBe(true);
    props.node.queries = [{ id: 'q', text: 'coffee', provenance: 'asserted' }];
    props.node.contentBrief = { ...props.node.contentBrief, targetQueryId: 'q', snippetTarget: 'definition', draftMarkdown: 'Coffee guide', paragraphReviews: [{ paragraph: 'Coffee guide', treatment: 'editorial', sourceUrl: '', sourceChecked: false }] };
    view.rerender(<ContentBriefEditor {...props} />);
    fireEvent.click(screen.getByRole('button', { name: label('markDraft') }));
    expect(props.onAdvance).toHaveBeenCalledOnce();
    props.node.lifecycle = 'drafted';
    view.rerender(<ContentBriefEditor {...props} />);
    expect(screen.getByRole('button', { name: label('draftReady') })).toBeTruthy();
  });
});
