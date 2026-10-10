import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CrawledPageSummary } from '@/types';
import { CrawlArchitectureGraph } from '@/components/Charts/CrawlArchitectureGraph';
import { useProjectStore } from '@/stores/projectStore';
import { useToolsStore } from '@/stores/toolsStore';
import i18n from '@/i18n';
import { pages } from "./fixtures/crawlArchitectureGraphContracts";
import { createSemanticCrawlRunFixture } from './fixtures/semanticCrawlRun';

describe('CrawlArchitectureGraph', () => {
beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('pl');
    useProjectStore.setState({ activeProjectId: null });
    useToolsStore.setState({ selectedCrawlRunId: null });
  });

it('provides a compact bottom view picker for narrow windows', () => {
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} />);

    fireEvent.change(screen.getByLabelText('Wybierz widok mapy'), { target: { value: 'directory' } });

    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('crawl-map-view-directory');
    expect(screen.getByText('Struktura URL z audytu')).toBeTruthy();
  });

it('remembers the selected map view and supports Home/End in the bottom dock', () => {
    useProjectStore.setState({ activeProjectId: 'project-map-navigation' });
    const view = render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="navigation-run" />);
    const bottomDock = screen.getByRole('toolbar', { name: 'Widoki mapy na dole' });

    fireEvent.click(within(bottomDock).getByRole('button', { name: 'Przejdź do widoku Topical plan' }));
    expect(screen.getByRole('tab', { name: 'Topical plan' }).getAttribute('aria-selected')).toBe('true');
    expect(localStorage.getItem('seomi_project_project-map-navigation_semantic_map_navigation-run_v1')).toContain('"activeView":"plan"');

    fireEvent.keyDown(bottomDock, { key: 'Home' });
    expect(screen.getByRole('tab', { name: 'Graf crawla' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(bottomDock, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Topical plan' }).getAttribute('aria-selected')).toBe('true');

    view.unmount();
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="navigation-run" />);
    expect(screen.getByRole('tab', { name: 'Topical plan' }).getAttribute('aria-selected')).toBe('true');
  });

it('paginates large directory nodes while retaining all-run metrics', () => {
    const manyPages = Array.from({ length: 105 }, (_, index) => ({
      url: `https://example.com/blog?article=${index}`,
      final_url: `https://example.com/blog?article=${index}`,
      title: `Article ${index}`,
      http_status: 200,
      word_count: 20,
      issues: [],
      semantic_terms: [],
      semantic_links: [],
      links: [],
    })) as unknown as CrawledPageSummary[];
    useProjectStore.setState({ activeProjectId: 'project-wide-crawl' });
    render(<CrawlArchitectureGraph pages={manyPages} startUrl={manyPages[0].url} runId="wide-run" />);

    fireEvent.click(screen.getByRole('tab', { name: 'Drzewo URL' }));
    const directory = within(screen.getByRole('tabpanel'));
    fireEvent.click(directory.getByText('blog').closest('summary')!);
    expect(directory.getAllByText('105')).toHaveLength(2);
    // The catalog excludes the graph, dock and metrics from role traversal.
    const catalog = within(directory.getByRole('list', { name: i18n.t('crawlDirectoryUi.catalogAria') }));
    const showMore = catalog.getByRole('button', { name: /Pokaż kolejne 5 URL-i/ });
    expect(showMore).toBeTruthy();
    expect(catalog.getByText('Article 0')).toBeTruthy();
    expect(catalog.queryByText('Article 99')).toBeNull();

    fireEvent.click(showMore);
    expect(catalog.getByText('Article 99')).toBeTruthy();
    expect(localStorage.getItem('seomi_project_project-wide-crawl_crawl_directory_wide-run_v1')).toContain('visibleCounts');
  });

it('persists filters and zoom against the active project and saved crawl run', async () => {
    useProjectStore.setState({ activeProjectId: 'project-semantic' });
    const view = render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="run-semantic" />);
    fireEvent.change(screen.getByLabelText('Szukaj strony lub terminu na mapie'), { target: { value: 'burr' } });
    const preferenceKey = 'seomi_project_project-semantic_semantic_map_run-semantic_v1';
    expect(localStorage.getItem(preferenceKey)).toContain('burr');
    fireEvent.wheel(screen.getByRole('img', { name: 'Interaktywna mapa semantycznych klastrów i linków w treści' }), {
      deltaY: -100,
      clientX: 300,
      clientY: 220,
    });
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? '{}');
      expect(saved.transform.k).toBeGreaterThan(1);
    });

    view.unmount();
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="run-semantic" />);
    expect(screen.getByLabelText('Szukaj strony lub terminu na mapie').getAttribute('value')).toBe('burr');
    expect(screen.getByText('1/2 URL-i')).toBeTruthy();
  });

it('carries saved crawl snapshots from the visualization into the semantic audit baseline selector', () => {
    useProjectStore.setState({ activeProjectId: 'project-semantic-chain' });
    const baseline = createSemanticCrawlRunFixture('older-run', '2026-09-20T10:00:00.000Z', 'project-semantic-chain', pages);
    const current = createSemanticCrawlRunFixture('current-run', '2026-09-21T10:00:00.000Z', 'project-semantic-chain', pages);
    render(<CrawlArchitectureGraph pages={pages} startUrl={pages[0].url} runId="current-run" currentRunId="current-run" runs={[baseline, current]} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Topical plan' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Audyt semantyczny' }));

    expect(screen.getByLabelText('Bazowy crawl-run dla audytu semantycznego')).toBeTruthy();
    expect(screen.getByRole('option', { name: /2 URL/i })).toBeTruthy();
  });

it('uses the controlled current run when the global store still points at an older run', () => {
    useProjectStore.setState({ activeProjectId: 'project-run-precedence' });
    useToolsStore.setState({ selectedCrawlRunId: 'stale-run' });

    render(
      <CrawlArchitectureGraph
        pages={pages}
        startUrl={pages[0].url}
        runId="fallback-run"
        currentRunId="current-run"
      />,
    );
    fireEvent.change(screen.getByLabelText('Szukaj strony lub terminu na mapie'), {
      target: { value: 'burr' },
    });

    expect(
      localStorage.getItem(
        'seomi_project_project-run-precedence_semantic_map_current-run_v1',
      ),
    ).toContain('burr');
    expect(
      localStorage.getItem(
        'seomi_project_project-run-precedence_semantic_map_stale-run_v1',
      ),
    ).toBeNull();
  });
});
