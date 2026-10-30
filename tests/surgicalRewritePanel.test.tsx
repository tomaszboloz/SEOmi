import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurgicalRewritePanel } from '@/components/Domain/crawlResults/focus/SurgicalRewritePanel';
import i18n from '@/i18n';
import type { PageFocus, SiteFocusReport } from '@/services/siteFocus';
import type { CrawledPageSummary } from '@/types';

const copy = vi.hoisted(() => vi.fn(async (_text: string) => true));
vi.mock('@/services/clipboard', () => ({ copyText: copy }));

const section = (heading: string, level: number, paragraphs: string[]) => ({ heading, level, paragraphs, tables: 0, ordered_lists: 0, unordered_lists: 0, definition_lists: 0 });
const url = 'https://a.test/coffee';
const crawled = { url, document_language: 'en', rag_sections: [section('Benefits & effects', 2, ['It makes the day better. More text.']), section('Our bikes', 3, ['Bike sale: mountain bike and city bike.'])] } as unknown as CrawledPageSummary;
const page = { url, type: 'article', weight: 1, trs: 40, offTopicKeywords: [{ term: 'bike', count: 3, cluster: 'x' }] } as unknown as PageFocus;
const report = { score: 60, pages: [page], model: { language: 'en' }, coreTopic: { label: 'coffee', terms: [{ term: 'coffee', weight: 2, coveragePct: 80 }, { term: 'arabica', weight: 1, coveragePct: 40 }] } } as unknown as SiteFocusReport;

beforeEach(async () => { await i18n.changeLanguage('en'); copy.mockClear(); });

describe('SurgicalRewritePanel (#127)', () => {
  it('shows location, before/after, dangling hint, drift and copies escaped After HTML', async () => {
    render(<SurgicalRewritePanel crawled={crawled} page={page} report={report} />);
    expect(screen.getByText(`Page ${url}, under H2 «Benefits & effects» (section #1).`)).toBeTruthy();
    expect(screen.getByText('Missing Core Topic entities: coffee, arabica')).toBeTruthy();
    expect(screen.getByText('Benefits & effects: coffee')).toBeTruthy();
    expect(screen.getByText(/The first sentence opens with “it”/)).toBeTruthy();
    expect(screen.getByText('«Our bikes» — off-topic terms: bike')).toBeTruthy();
    expect(screen.getByText(/simulated by the SFS engine/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy After HTML' }));
    expect(await screen.findByText('Copied')).toBeTruthy();
    expect(copy.mock.calls[0][0]).toBe('<h2>Benefits &amp; effects: coffee</h2>\n<p>coffee: [direct answer in 1–2 sentences that names coffee, arabica]</p>\n<p>It makes the day better. More text.</p>');
  });

  it('explains missing sections instead of guessing a location', () => {
    render(<SurgicalRewritePanel crawled={{ ...crawled, rag_sections: [] }} page={page} report={report} />);
    expect(screen.getByText(/No H2\/H3 sections were captured/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
