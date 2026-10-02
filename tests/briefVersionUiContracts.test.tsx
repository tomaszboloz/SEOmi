import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefVersionHistory } from '@/components/Charts/contentBrief/BriefVersionHistory';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import { briefLabel as label, briefProps } from './fixtures/briefUiContracts';

describe('brief version controls', () => {
  it('saves an explicit checkpoint and clears the note after successful persistence', () => {
    const props = briefProps();
    props.node.contentBrief.draftMarkdown = 'new draft';
    const view = render(<BriefVersionHistory model={createBriefModel(props)} />);
    fireEvent.change(screen.getByLabelText(label('versionNoteAria')), { target: { value: ' Reviewed ' } });
    fireEvent.click(screen.getByRole('button', { name: label('saveVersion') }));
    expect(props.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ draftVersions: [expect.objectContaining({ note: 'Reviewed', draftMarkdown: 'new draft' })] }));
    expect((screen.getByLabelText(label('versionNoteAria')) as HTMLInputElement).value).toBe('');
    props.node.contentBrief.draftVersions = [{ id: 'old', note: '', savedAt: '2026-10-01', draftMarkdown: 'old\n\nline' }];
    view.rerender(<BriefVersionHistory model={createBriefModel(props)} />);
    fireEvent.change(screen.getByRole('combobox', { name: label('diffAria') }), { target: { value: 'old' } });
    expect(screen.getByRole('status', { name: label('diffAria') }).textContent).toContain('old');
    fireEvent.click(screen.getByRole('button', { name: label('restoreVersion') }));
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ draftMarkdown: 'old\n\nline' }));
  });

  it('shows unchanged and reordered checkpoint diffs and disables empty/identical actions', () => {
    const props = briefProps();
    props.node.contentBrief.draftMarkdown = 'one\ntwo';
    props.node.contentBrief.draftVersions = [{ id: 'old', note: 'note', savedAt: '2026-10-01', draftMarkdown: 'one\ntwo' }];
    const view = render(<BriefVersionHistory model={createBriefModel(props)} />);
    expect((screen.getByRole('button', { name: label('restoreVersion') }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole('combobox', { name: label('diffAria') }), { target: { value: 'old' } });
    expect(screen.getByRole('status').textContent).toContain(label('noChanges'));
    fireEvent.click(screen.getByRole('button', { name: label('saveVersion') }));
    expect(props.onUpdate).toHaveBeenCalledOnce();
    props.node.contentBrief.draftMarkdown = 'two\none';
    view.rerender(<BriefVersionHistory model={createBriefModel(props)} />);
    expect(screen.queryByText(label('showChangedLines'))).toBeNull();
    props.node.contentBrief.draftMarkdown = '';
    view.rerender(<BriefVersionHistory model={createBriefModel(props)} />);
    expect((screen.getByRole('button', { name: label('saveVersion') }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not persist a duplicate checkpoint when both draft and note are unchanged', () => {
    const props = briefProps();
    props.node.contentBrief.draftMarkdown = 'same';
    props.node.contentBrief.draftVersions = [{ id: 'old', note: '', savedAt: '2026-10-01', draftMarkdown: 'same' }];
    render(<BriefVersionHistory model={createBriefModel(props)} />);
    fireEvent.click(screen.getByRole('button', { name: label('saveVersion') }));
    expect(props.onUpdate).not.toHaveBeenCalled();
  });
});
