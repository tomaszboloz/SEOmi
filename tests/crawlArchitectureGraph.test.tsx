import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { CrawlArchitectureGraph } from '@/components/Charts/CrawlArchitectureGraph';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';
import { pages } from "./fixtures/crawlArchitectureGraphContracts";

describe('CrawlArchitectureGraph', () => {
beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('pl');
    useProjectStore.setState({ activeProjectId: null });
    useToolsStore.setState({ selectedCrawlRunId: null });
  });

it('renders the content-only force map and lets users select a page from its accessible list', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);

    expect(screen.getByRole('img', { name: 'Interaktywna mapa semantycznych klastrów i linków w treści' })).toBeTruthy();
    expect(screen.getByText(/1 relacja · 1 link treści/)).toBeTruthy();
    expect(screen.getAllByText('brewing · 2')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '/coffee' }));
    expect(screen.getByText('Wybrana strona')).toBeTruthy();
    expect(screen.getByText('Coffee brewing')).toBeTruthy();
    expect(screen.getByText('Linki z głównej treści')).toBeTruthy();
    expect(screen.getAllByText(/grinding guide/).length).toBeGreaterThan(0);
  });

it('makes force-graph nodes keyboard-selectable', async () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);

    const graph = screen.getByRole('img', { name: 'Interaktywna mapa semantycznych klastrów i linków w treści' });
    const nodes = graph.querySelectorAll('[role="button"]');
    expect(nodes.length).toBe(2);
    fireEvent.keyDown(nodes[1], { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Coffee grinding')).toBeTruthy();
      expect(nodes[1].getAttribute('aria-pressed')).toBe('true');
    });
  });

it('shows semantic extraction provenance for rendered DOM and body fallback pages', () => {
    const pagesWithSources = pages.map((page, index) => ({
      ...page,
      semantic_content_source: index === 0 ? 'primary-root' : 'body-fallback',
      semantic_content_provenance: 'rendered',
      semantic_content_partial: index === 1,
    })) as unknown as CrawledPageSummary[];
    render(<CrawlArchitectureGraph pages={pagesWithSources} startUrl={pages[0].url} crawlMode="browser-rendered" />);

    expect(screen.getByText(/renderowany DOM po JavaScript/)).toBeTruthy();
    expect(screen.getByText(/Główna treść: 1 · fallback: 1 · niedostępne: 0 · częściowe: 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '/coffee' }));
    expect(screen.getByText('Coffee brewing').closest('aside')?.textContent).toContain('źródło snapshotu');
    fireEvent.click(screen.getByRole('button', { name: '/grinding' }));
    expect(screen.getByText('Coffee grinding').closest('aside')?.textContent).toContain('częściowe dowody semantyczne');
  });

it('switches to the full internal link graph and persists the scope', () => {
    useProjectStore.setState({ activeProjectId: 'project-full-link-graph' });
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="full-link-run" />);

    fireEvent.click(screen.getByRole('button', { name: 'Wszystkie linki' }));
    expect(screen.getByText(/2 relacje · 2 linki wewnętrzne/)).toBeTruthy();
    expect(localStorage.getItem('seomi_project_project-full-link-graph_semantic_map_full-link-run_v1')).toContain('"linkMode":"all"');
  });

it('shows recorded discovery evidence for the selected graph node', () => {
    const pagesWithDiscovery = pages.map((page, index) => index === 0
      ? {
          ...page,
          discovery_sources: [{ kind: 'sitemap', source_url: 'https://example.com/sitemap.xml' }],
        }
      : page) as unknown as CrawledPageSummary[];
    render(<CrawlArchitectureGraph pages={pagesWithDiscovery} startUrl={pages[0].url} />);

    fireEvent.click(screen.getByRole('button', { name: '/coffee' }));

    expect(screen.getByText('Odkrycie URL')).toBeTruthy();
    expect(screen.getByText('sitemap')).toBeTruthy();
    expect(screen.getByText(/sitemap\.xml/)).toBeTruthy();
  });

it('filters the graph and accessible page list by content term', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);
    fireEvent.change(screen.getByLabelText('Szukaj strony lub terminu na mapie'), { target: { value: 'burr' } });

    expect(screen.getByText('1/2 URL-i')).toBeTruthy();
    expect(screen.getByRole('button', { name: '/grinding' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '/coffee' })).toBeNull();
  });

it('filters localized terms without requiring diacritics', () => {
    const localizedPages = pages.map((page, index) => index === 0
      ? { ...page, semantic_terms: ['żółć', 'świat'] }
      : { ...page, semantic_terms: ['kawa', 'młynek'] }) as unknown as CrawledPageSummary[];
    render(<CrawlArchitectureGraph pages={localizedPages} startUrl={localizedPages[0].url} />);

    fireEvent.change(screen.getByLabelText('Szukaj strony lub terminu na mapie'), { target: { value: 'zolc' } });

    expect(screen.getByText('1/2 URL-i')).toBeTruthy();
    expect(screen.getByRole('button', { name: '/coffee' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '/grinding' })).toBeNull();
  });

it('opens the crawl directory view and filters the saved run URL tree', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="directory-run" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Drzewo URL' }));
    expect(screen.getByText('Struktura URL z audytu')).toBeTruthy();
    expect(screen.getByLabelText('Metryki wybranego crawl-run')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Filtruj drzewo URL'), { target: { value: 'grinding' } });
    expect(screen.getByText('grinding')).toBeTruthy();
  });

it('keeps map view tabs in document flow and keyboard-navigable', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);

    const viewTabs = screen.getByRole('tablist', { name: 'Widoki mapy semantycznej' });
    expect(viewTabs.parentElement?.parentElement?.className).not.toContain('sticky');
    fireEvent.keyDown(viewTabs, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Drzewo URL' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(viewTabs, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Topical plan' }).getAttribute('aria-selected')).toBe('true');
  });

it('keeps map navigation available at the bottom of long map content', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);

    expect(screen.getByRole('group', { name: 'Sterowanie powiększeniem mapy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Powiększ mapę' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pomniejsz mapę' })).toBeTruthy();

    const bottomNavigation = screen.getByRole('navigation', { name: 'Szybka nawigacja mapy semantycznej' });
    expect(bottomNavigation.parentElement?.className).toContain('fixed');
    expect(bottomNavigation.closest('section')?.className).toContain('pb-40');
    fireEvent.click(screen.getByRole('button', { name: 'Przejdź do widoku Drzewo URL' }));
    expect(screen.getByText('Struktura URL z audytu')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Przejdź do widoku Topical plan' }));
    expect(screen.getByText('Wybierz lub utwórz projekt, aby zapisywać topical mapę.')).toBeTruthy();
    expect(within(bottomNavigation).getByRole('button', { name: 'Wróć na początek mapy' })).toBeTruthy();
    expect(within(bottomNavigation).getByRole('button', { name: 'Wróć do zakładek wyników crawl' })).toBeTruthy();
  });
});
