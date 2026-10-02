import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BriefLinkPlan } from '@/components/Charts/contentBrief/BriefLinkPlan';
import { createBriefModel } from '@/components/Charts/contentBrief/model';
import type { CrawledPageSummary } from '@/types';
import { briefLabel as label, briefModel, briefProps } from './fixtures/briefUiContracts';

describe('brief internal link planning', () => {
  it('exposes crawled and unverified targets separately and normalizes target removal', () => {
    const props = briefProps({ pages: [{ url: 'https://site.test/request', final_url: 'https://site.test/final', title: 'Guide' }] as CrawledPageSummary[] });
    props.node.sourceUrls = ['https://site.test/outside', 'https://site.test/outside#part', '', 'https://site.test/request'];
    props.node.contentBrief.internalLinkTargets = ['https://site.test/outside#part'];
    const model = createBriefModel(props);
    expect([...model.crawledUrls]).toEqual(['https://site.test/request', 'https://site.test/final']);
    expect(model.unverifiedPlanTargets).toEqual(['https://site.test/outside']);
    render(<BriefLinkPlan model={model} />);
    const crawled = screen.getByLabelText(label('addInternal', { url: 'https://site.test/final' }));
    fireEvent.click(crawled);
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ internalLinkTargets: ['https://site.test/outside#part', 'https://site.test/final'] }));
    fireEvent.click(screen.getByLabelText(label('addUnverified', { url: 'https://site.test/outside' })));
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ internalLinkTargets: [] }));
    expect(screen.getByText(label('unavailableTargets', { count: 1 }))).toBeTruthy();
  });

  it('caps crawl/plan display with disclosures and never adds a fifty-first internal target', () => {
    const pages = Array.from({ length: 501 }, (_, i) => ({ url: `https://site.test/page${i}` })) as CrawledPageSummary[];
    const props = briefProps({ pages });
    props.node.sourceUrls = Array.from({ length: 101 }, (_, i) => `https://site.test/outside${i}`);
    props.node.contentBrief.internalLinkTargets = pages.slice(0, 50).map((page) => page.url);
    const view = render(<BriefLinkPlan model={createBriefModel(props)} />);
    expect(view.container.querySelectorAll('input[type="checkbox"]')).toHaveLength(600);
    expect(screen.getByText(label('limited500'))).toBeTruthy();
    expect(screen.getByText(label('limited100'))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(label('addInternal', { url: pages[50].url })));
    expect(props.onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ internalLinkTargets: props.node.contentBrief.internalLinkTargets }));
  });

  it('discloses missing crawl and allows explicit unverified planned targets', () => {
    const model = briefModel();
    model.unverifiedPlanTargets = ['https://site.test/outside'];
    render(<BriefLinkPlan model={model} />);
    expect(screen.getByText(label('runCrawl'))).toBeTruthy();
    fireEvent.click(screen.getByLabelText(label('addUnverified', { url: 'https://site.test/outside' })));
    expect(model.onUpdate).toHaveBeenCalledWith(expect.objectContaining({ internalLinkTargets: ['https://site.test/outside'] }));
  });
});
