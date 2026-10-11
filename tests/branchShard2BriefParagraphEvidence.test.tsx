import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefParagraphs } from '@/components/Charts/contentBrief/BriefParagraphs';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import type { BriefEditorProps } from '@/components/Charts/contentBrief/types';
import { briefLabel as label, briefProps } from './fixtures/briefUiContracts';
import { createCrawlPageFixture as page } from './fixtures/crawl';

type Review = BriefEditorProps['node']['contentBrief']['paragraphReviews'][number];

describe('brief paragraph evidence without response spans', () => {
  it('renders a source-backed paragraph whose review has no URL or confirmation yet', () => {
    const props = briefProps();
    const paragraph = 'Coffee beans roasted for flavour';
    props.node.contentBrief.draftMarkdown = paragraph;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed' } as unknown as Review];
    render(<BriefParagraphs model={createBriefModel(props)} />);
    expect((screen.getByLabelText(label('sourceUrl')) as HTMLInputElement).value).toBe('');
    const confirm = screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement;
    expect(confirm.checked).toBe(false);
    expect(confirm.disabled).toBe(true);
  });

  it('shows the overlap percentage without an evidence range for a verbatim excerpt match', () => {
    const props = briefProps();
    const excerpt = 'Freshly roasted coffee beans develop a sweeter and rounder flavour';
    const paragraph = `${excerpt} when stored correctly.`;
    props.node.contentBrief.draftMarkdown = paragraph;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed', sourceUrl: 'https://site.test/evidence', sourceChecked: false }];
    props.pages = [page({ url: 'https://site.test/evidence', semantic_excerpts: [excerpt], semantic_terms: ['coffee'] })];
    render(<BriefParagraphs model={createBriefModel(props)} />);
    const note = screen.getByText((_, element) => element?.tagName === 'P' && !!element.textContent?.includes('100%'));
    expect(note.textContent).not.toContain(label('evidenceRange', { range: '' }).trim());
  });
});
