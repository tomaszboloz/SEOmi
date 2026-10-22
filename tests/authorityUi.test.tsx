import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlAuthorityTab } from '@/components/Domain/crawlResults/authority/CrawlAuthorityTab';
import { readAuthorityHistory, readTaxonomy, readTopicalBenchmark, writeTaxonomy } from '@/services/topicalAuthorityMonitoring';
import type { ReferenceOutcome } from '@/services/topicalAuthorityReference';
import { COMPETITORS, OWN_HOST, ownSite, referenceTaxonomy } from './authorityFixtures';
import { createCrawlResultFixture, createCrawlRunFixture } from './fixtures/crawl';

vi.mock('@/services/desktopNotifications/delivery', () => ({ sendProjectNotification: vi.fn().mockResolvedValue(false) }));

const pages = ownSite();
const START = `https://${OWN_HOST}/`;
const makeRun = (id: string) => createCrawlRunFixture({ id, startUrl: START, result: createCrawlResultFixture({ pages, start_url: START }) });
const okOutcome = (): ReferenceOutcome => ({ status: 'ok', taxonomy: referenceTaxonomy(pages)!, competitors: COMPETITORS });

beforeEach(async () => { localStorage.clear(); await i18n.changeLanguage('en'); });

describe('Authority tab', () => {
  it('shows the partial analysis and an honest empty state without a reference map', () => {
    render(<CrawlAuthorityTab pages={pages} startUrl={START} />);
    expect(screen.getByTestId('authority-gauge-tas').textContent).toContain('—');
    expect(screen.getByText('Reference map')).toBeTruthy();
    expect(screen.getByText(/Nothing is invented/)).toBeTruthy();
    expect(screen.getByText('The matrix appears once TAS is calculated.')).toBeTruthy();
    expect(screen.getByText(/Build the reference map to compare/)).toBeTruthy();
    expect(screen.getByTestId('authority-pillar-tcr').textContent).toContain('not measurable');
    expect(screen.queryByText('Topic coverage map')).toBeNull();
  });

  it('renders the empty state when there are no pages', () => {
    render(<CrawlAuthorityTab pages={[]} startUrl={START} />);
    expect(screen.getByText('Run a crawl to measure topical authority.')).toBeTruthy();
  });

  it('builds the reference map, shows TAS, coverage, benchmark and persists everything', async () => {
    const runner = vi.fn(async (input: { onProgress?: (p: { phase: 'crawl'; done: number; total: number; domain: string }) => void }) => {
      input.onProgress?.({ phase: 'crawl', done: 1, total: 3, domain: 'rival-one.test' });
      return okOutcome();
    });
    render(<CrawlAuthorityTab pages={pages} startUrl={START} run={makeRun('r1')} projectId="p1" runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build reference map' }));
    await waitFor(() => expect(screen.getByText('Topic coverage map')).toBeTruthy());
    expect(runner).toHaveBeenCalledTimes(1);
    expect(readTaxonomy('p1')).not.toBeNull();
    expect(screen.getByTestId('authority-gauge-tas').textContent).not.toContain('—');
    expect(screen.getByRole('img', { name: /quadrant/i })).toBeTruthy();
    expect(screen.getByText(/Rebuild map/)).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Pillar coverage' })).toBeTruthy();
    await waitFor(() => expect(readTopicalBenchmark('p1')).not.toBeNull());
    expect(readAuthorityHistory('p1').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: /^Gaps only/ }));
    fireEvent.click(screen.getByRole('button', { name: /^All \(/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Shallow/ }));
    const rows = screen.getAllByRole('button', { name: /match/ });
    fireEvent.click(rows[0]);
    expect(screen.getByText(/Sub-topic analysis/)).toBeTruthy();
    expect(screen.getByText(/Assigned page/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(screen.getByText('Topic coverage map')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Cannibalized/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard map' }));
    expect(readTaxonomy('p1')).toBeNull();
    expect(screen.queryByText('Topic coverage map')).toBeNull();
  });

  it('shows unavailable, cancelled and error outcomes of the map builder', async () => {
    const outcomes: Array<ReferenceOutcome | Error> = [
      { status: 'unavailable', reason: 'no-serp-source' }, { status: 'cancelled' }, new Error('boom'),
    ];
    const runner = vi.fn(async () => { const next = outcomes.shift() as ReferenceOutcome | Error; if (next instanceof Error) throw next; return next; });
    render(<CrawlAuthorityTab pages={pages} startUrl={START} projectId="p2" runner={runner} />);
    const build = () => fireEvent.click(screen.getByRole('button', { name: 'Build reference map' }));
    build();
    await waitFor(() => expect(screen.getByText(/Connect a SERP source/)).toBeTruthy());
    build();
    await waitFor(() => expect(screen.getByText('Map building was cancelled.')).toBeTruthy());
    build();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('boom'));
  });

  it('cancels a running build', async () => {
    let release: (value: ReferenceOutcome) => void = () => undefined;
    const runner = vi.fn(() => new Promise<ReferenceOutcome>((resolve) => { release = resolve; }));
    render(<CrawlAuthorityTab pages={pages} startUrl={START} runner={runner} />);
    fireEvent.click(screen.getByRole('button', { name: 'Build reference map' }));
    expect(screen.getByRole('status').textContent).toContain('Fetching rankings');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await act(async () => release({ status: 'cancelled' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Build reference map' })).toBeTruthy());
  });

  it('loads a cached map for the project and checks a draft for overlap', async () => {
    writeTaxonomy('p3', referenceTaxonomy(pages)!);
    render(<CrawlAuthorityTab pages={pages} startUrl={START} run={makeRun('r3')} projectId="p3" />);
    expect(screen.getByText('Topic coverage map')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Draft title'), { target: { value: 'Espresso machines' } });
    fireEvent.change(screen.getByLabelText('Draft text'), { target: { value: 'coffee espresso roast bean grinder brew barista crema extraction filter arabica kettle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check overlap' }));
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Draft title'), { target: { value: 'Quantum' } });
    fireEvent.change(screen.getByLabelText('Draft text'), { target: { value: 'gluon quark boson lattice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check overlap' }));
    expect(screen.getByText('No overlap above 85% with existing pages.')).toBeTruthy();
  });
});
