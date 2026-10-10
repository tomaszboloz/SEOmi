import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefParagraphs } from '@/components/Charts/contentBrief/BriefParagraphs';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import { briefLabel as label, briefProps } from './fixtures/briefUiContracts';
import { createCrawlPageFixture as page } from './fixtures/crawl';

describe('brief paragraph evidence edges', () => {
  it('labels a matched semantic-term source without auto-confirming it', () => {
    const props = briefProps();
    const paragraph = 'Coffee beans roasted for flavour';
    props.node.contentBrief.draftMarkdown = paragraph;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed', sourceUrl: 'https://site.test/evidence', sourceChecked: false }];
    props.pages = [page({ url: 'https://site.test/evidence', title: 'Coffee beans flavour', semantic_terms: ['coffee', 'beans', 'flavour'] })];
    render(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && !!element.textContent?.includes(label('sharedTerms')))).toBeTruthy();
    expect((screen.getByLabelText(label('confirmSourceAria', { index: 1 })) as HTMLInputElement).checked).toBe(false);
  });

  it('keeps title-only and empty-title evidence as insufficient signals', () => {
    const props = briefProps();
    const paragraph = 'Coffee beans roasted for flavour';
    props.node.contentBrief.draftMarkdown = paragraph;
    props.node.contentBrief.paragraphReviews = [{ paragraph, treatment: 'source-backed', sourceUrl: 'https://site.test/evidence', sourceChecked: false }];
    props.pages = [page({ url: 'https://site.test/evidence', title: 'Coffee', semantic_terms: [] })];
    const view = render(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && !!element.textContent?.includes('not enough lexical signal'))).toBeTruthy();
    props.pages = [page({ url: 'https://site.test/evidence', title: '', semantic_terms: [] })];
    view.rerender(<BriefParagraphs model={createBriefModel(props)} />);
    expect(screen.getByText((_, element) => element?.tagName === 'P' && !!element.textContent?.includes('not enough lexical signal'))).toBeTruthy();
  });
});
