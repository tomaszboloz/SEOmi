import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefParagraphs } from '@/components/Charts/contentBrief/BriefParagraphs';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import { briefLabel as label, briefProps } from './fixtures/briefUiContracts';

describe('brief paragraph review direct edges', () => {
  it('keeps source confirmation disabled until a source URL is valid and reports unreviewed work', () => {
    const paragraph = 'A short editorial paragraph.';
    const unreviewed = 'A second paragraph awaiting review.';
    const props = briefProps();
    props.node.contentBrief.draftMarkdown = `${paragraph}\n\n${unreviewed}`;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed', sourceUrl: '', sourceChecked: true }];
    const view = render(<BriefParagraphs model={createBriefModel(props)} />);
    const checkbox = screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText(label('unreviewedCount', { count: 1 }))).toBeTruthy();
    expect(screen.getByText(label('unsupportedParagraph'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label('sourceUrl')), { target: { value: 'mailto:editor@example.com' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ sourceUrl: 'mailto:editor@example.com', sourceChecked: false })] }));
    props.node.contentBrief.paragraphReviews[0].sourceUrl = 'https://example.com/source';
    props.node.contentBrief.paragraphReviews[0].sourceChecked = false;
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    expect((screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText(label('confirmSourceAria', { index: 1 })));
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ sourceChecked: true })] }));
  });
});
