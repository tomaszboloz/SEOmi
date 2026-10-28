import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlTrustTab } from '@/components/Domain/crawlResults/trust/CrawlTrustTab';
import { readTrustHistory } from '@/services/eeatTrust';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';
import { START, diabetesPages, node, trustedArticle, withRefs } from './eeatTrustFixtures';

const trusted = diabetesPages().map((page) => (page.url.includes('/articles/') ? trustedArticle(page) : page));
const anonymous = diabetesPages().map((page) => (page.url.includes('/articles/')
  ? withRefs(page, node('$', { type: 'Article', props: [['author', 'Redakcja']] }))
  : page));
const makeRun = (id: string, pages = trusted) => createCrawlRunFixture({ id, startUrl: START, result: createCrawlResultFixture({ pages }) });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('CrawlTrustTab', () => {
  it('shows the empty state without pages', () => {
    render(<CrawlTrustTab pages={[]} startUrl={START} />);
    expect(screen.getByText('Run a crawl first to assess trust signals.')).toBeTruthy();
  });

  it('renders score, layers, entities and trust pages for an attributed site', () => {
    render(<CrawlTrustTab pages={trusted} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    expect(Number(screen.getByTestId('trust-score').textContent)).toBeGreaterThan(50);
    expect(screen.getByText(/YMYL category: health/)).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Trust layers' })).toBeTruthy();
    expect(screen.getByText('Anna Nowak')).toBeTruthy();
    expect(screen.getByText(/Publisher: Diabetes Portal/)).toBeTruthy();
    expect(screen.getByText(/Diabetes Portal \(Publisher\) · syntax-valid · sameAs declaration 45%/)).toBeTruthy();
    expect(screen.getByText(/Role-weighted sameAs declaration: \d+%/)).toBeTruthy();
    expect(screen.getByTestId('trust-profile').textContent).toContain('eetv-5-layer-v2');
    expect(screen.getByTestId('trust-coverage').textContent).toContain('Evidence coverage');
    expect(within(screen.getByRole('list', { name: 'Trust pages' })).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText(/of \d+ article pages link to a trusted source/)).toBeTruthy();
  });

  it('labels the source quality layer as unverified while no external link was checked', () => {
    const unchecked = trusted.map((page) => ({ ...page, links: page.links.map((link) => ({ ...link, target_http_status: undefined, target_request_error_kind: undefined })) }));
    render(<CrawlTrustTab pages={unchecked} startUrl={START} run={makeRun('r1u', unchecked)} projectId="p1" />);
    expect(screen.getByText('unverified')).toBeTruthy();
  });

  it('flags anonymous YMYL bylines and lists dead links', () => {
    const pages = anonymous.map((page, index) => (index === 2
      ? { ...page, links: [...page.links, { target_url: 'https://gone.example/x', anchor_text: 'x', is_internal: false, target_http_status: 404 }] }
      : page));
    render(<CrawlTrustTab pages={pages} startUrl={START} run={makeRun('r2', pages)} projectId="p1" />);
    expect(screen.getByRole('alert').textContent).toMatch(/have no named author or reviewer/);
    expect(screen.getByText('anonymous byline')).toBeTruthy();
    expect(screen.getAllByText(/Critical/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/outbound links are broken/));
    expect(screen.getByText(/gone\.example/)).toBeTruthy();
  });

  it('records one snapshot per run and shows the previous score', async () => {
    const first = render(<CrawlTrustTab pages={anonymous} startUrl={START} run={makeRun('r1', anonymous)} projectId="p1" />);
    await act(async () => {});
    expect(readTrustHistory('p1')).toHaveLength(1);
    first.unmount();
    render(<CrawlTrustTab pages={trusted} startUrl={START} run={makeRun('r2')} projectId="p1" />);
    await act(async () => {});
    expect(readTrustHistory('p1')).toHaveLength(2);
    expect(screen.getByText(/Previous run:/)).toBeTruthy();
  });

  it('opens the JSON-LD generator prefilled from an author, copies and closes it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CrawlTrustTab pages={trusted} startUrl={START} run={makeRun('r1')} projectId="p1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fix with JSON-LD' })[0]);
    expect((screen.getByLabelText('Author name') as HTMLInputElement).value).toBe('Anna Nowak');
    expect(screen.getByLabelText('Generated JSON-LD').textContent).toContain('"@type": "Person"');
    fireEvent.change(screen.getByLabelText('Author name'), { target: { value: '' } });
    expect(within(screen.getByRole('region', { name: 'JSON-LD generator' })).getByRole('alert').textContent).toContain('Enter the author name.');
    expect((screen.getByRole('button', { name: 'Copy script tag' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Author name'), { target: { value: 'Dr Anna' } });
    fireEvent.click(screen.getByLabelText('Declare as expert reviewer instead of author'));
    fireEvent.change(screen.getByLabelText(/sameAs profiles/), { target: { value: 'https://orcid.org/1\nbad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy script tag' }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"reviewedBy"'));
    expect(screen.getByRole('status').textContent).toBe('Copied.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Generated JSON-LD')).toBeNull();
  });

  it('reports a failed copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true });
    render(<CrawlTrustTab pages={trusted} startUrl={START} projectId={null} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Fix with JSON-LD' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Copy script tag' }));
    await act(async () => {});
    expect(screen.getByRole('status').textContent).toMatch(/Copy failed/);
  });

  it('renders nothing for authors on a site without author entities', () => {
    const bare = diabetesPages();
    render(<CrawlTrustTab pages={bare} startUrl={START} />);
    expect(screen.getByText('No author entities were found in the structured data.')).toBeTruthy();
    expect(screen.getByText(/No Organization entity was found in the structured data\./)).toBeTruthy();
    const noData = screen.getAllByText('n/a');
    expect(noData.length).toBeGreaterThan(0);
    noData.forEach((label) => expect(within(label.closest('li') as HTMLElement).queryByRole('meter')).toBeNull());
  });
});
