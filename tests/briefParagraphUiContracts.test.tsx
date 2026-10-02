import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefParagraphs } from '@/components/Charts/contentBrief/BriefParagraphs';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import type { CrawledPageSummary } from '@/types';
import { briefLabel as label, briefProps } from './fixtures/briefUiContracts';

describe('brief paragraph review controls', () => {
  it('requires explicit treatment, resets confirmation on URL changes and checks a valid source', () => {
    const props = briefProps();
    props.node.contentBrief.draftMarkdown = 'coffee beans roasted';
    const view = render(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText(label('unreviewedParagraph'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label('paragraphClassificationAria', { index: 1 })), { target: { value: 'source-backed' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [{ paragraph: 'coffee beans roasted', treatment: 'source-backed', sourceUrl: '', sourceChecked: false }] }));
    props.node.contentBrief.paragraphReviews = [{ paragraph: 'coffee beans roasted', treatment: 'source-backed', sourceUrl: '', sourceChecked: false }];
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    expect((screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(label('unsupportedParagraph'))).toBeTruthy();
    fireEvent.change(screen.getByLabelText(label('sourceUrl')), { target: { value: 'https://site.test/source' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ sourceUrl: 'https://site.test/source', sourceChecked: false })] }));
    props.node.contentBrief.paragraphReviews[0].sourceUrl = 'https://site.test/source';
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    fireEvent.click(screen.getByLabelText(label('confirmSourceAria', { index: 1 })));
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ sourceChecked: true })] }));
    props.node.contentBrief.paragraphReviews[0].sourceChecked = true;
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    fireEvent.change(screen.getByLabelText(label('paragraphClassificationAria', { index: 1 })), { target: { value: 'source-backed' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ sourceUrl: 'https://site.test/source', sourceChecked: false })] }));
    fireEvent.change(screen.getByLabelText(label('paragraphClassificationAria', { index: 1 })), { target: { value: 'editorial' } });
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ paragraphReviews: [expect.objectContaining({ treatment: 'editorial', sourceUrl: '', sourceChecked: false })] }));
  });

  it('labels missing, exact, sentence and term-only snapshot evidence without auto-confirming it', () => {
    const props = briefProps();
    const url = 'https://site.test/source';
    const paragraph = 'Coffee beans are roasted before brewing for a deeper flavour profile.';
    props.node.contentBrief.draftMarkdown = paragraph;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed', sourceUrl: url, sourceChecked: false }];
    const view = render(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText(label('notInSnapshot'))).toBeTruthy();
    const cases: Array<[Partial<CrawledPageSummary>, string]> = [
      [{ semantic_excerpts: [paragraph] }, label('matchingExcerpt')],
      [{ semantic_excerpts: ['Coffee beans roasted before brewing provide a deeper flavour profile.'] }, label('matchingSentence')],
      [{ semantic_terms: ['coffee', 'beans', 'roasted'] }, label('sharedTerms')],
    ];
    for (const [evidence, kind] of cases) {
      props.pages = [{ url, ...evidence }] as CrawledPageSummary[];
      view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
      expect(screen.getByText((_, element) => element?.tagName === 'P' && !!element.textContent?.includes(kind))).toBeTruthy();
      expect((screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement).checked).toBe(false);
      expect(props.onUpdate).not.toHaveBeenCalled();
    }
    for (const terms of [[], ['coffee']]) {
      props.pages = [{ url, semantic_terms: terms }] as CrawledPageSummary[];
      view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
      expect(screen.getByText(label('insufficientSignal', { terms: terms.length ? ` (${label('sharedTerms')}: coffee)` : '' }))).toBeTruthy();
    }
  });

  it('renders all paragraph reviews, discloses the persistence cap and shows an empty draft honestly', () => {
    const props = briefProps();
    const view = render(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText(label('emptyParagraphs'))).toBeTruthy();
    props.node.contentBrief.draftMarkdown = Array.from({ length: 501 }, (_, i) => `Paragraph ${i}`).join('\n\n');
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    expect(view.container.querySelectorAll('article')).toHaveLength(501);
    expect(screen.getByRole('alert').textContent).toBe(label('paragraphLimit'));
  });
});
