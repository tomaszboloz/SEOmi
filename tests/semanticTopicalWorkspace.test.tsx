import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { buildSemanticMap } from '@/services/semanticMap';
import { useToolsStore } from '@/stores/toolsStore';
import { shiftTopicalCalendarMonth } from '@/services/topicalMap';
import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';

const pages = [{ url: 'https://example.com/a', final_url: 'https://example.com/a', title: 'A', http_status: 200, indexability_status: 'Eligible from this response only', body_truncated: false, word_count: 300, semantic_terms: ['coffee', 'beans'], semantic_links: [] }] as unknown as CrawledPageSummary[];

describe('SemanticTopicalWorkspace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pl');
    localStorage.clear();
    useToolsStore.setState({ keywordResults: [], keywordResultsSource: null, gscData: null, gscDataFetchedAt: null, gscProperty: '' });
  });

  it('creates and persists an editable project topical node with hierarchy, query and URL assignment', () => {
    const graph = buildSemanticMap(pages, pages[0].url);
    render(<SemanticTopicalWorkspace projectId="project-topic" pages={pages} graph={graph} runId="run-1" />);

    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    const saved = JSON.parse(localStorage.getItem('seomi_project_project-topic_topical_map_v1') || '{}');
    const node = saved.nodes[0];
    expect(node.title).toBe('Nowy temat');
    expect(screen.getByLabelText('Nazwa')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Coffee pillar' } });
    fireEvent.change(screen.getByLabelText(i18n.t('semanticWorkspace.manualQueriesAria')), { target: { value: 'coffee guide\ncoffee beans' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Przypisz URL https://example.com/a do tematu Coffee pillar' }));

    const updated = JSON.parse(localStorage.getItem('seomi_project_project-topic_topical_map_v1') || '{}');
    expect(updated.nodes[0]).toMatchObject({ title: 'Coffee pillar', queries: [{ text: 'coffee guide' }, { text: 'coffee beans' }], sourceUrls: ['https://example.com/a'] });
  });

  it('supports drag-and-drop hierarchy changes, root moves and cycle prevention', () => {
    render(<SemanticTopicalWorkspace projectId="project-dnd" pages={pages} graph={buildSemanticMap(pages, pages[0].url)} runId="run-dnd" />);

    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Pillar' } });
    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Cluster' } });

    const mapKey = 'seomi_project_project-dnd_topical_map_v1';
    let saved = JSON.parse(localStorage.getItem(mapKey) || '{}');
    const pillarId = saved.nodes.find((node: { title: string }) => node.title === 'Pillar').id;
    const clusterId = saved.nodes.find((node: { title: string }) => node.title === 'Cluster').id;
    const transfer = (id: string) => ({ effectAllowed: 'move', setData: () => undefined, getData: () => id });

    fireEvent.dragStart(screen.getByRole('button', { name: 'Temat: Cluster' }), { dataTransfer: transfer(clusterId) });
    fireEvent.drop(screen.getByRole('button', { name: 'Temat: Pillar' }), { dataTransfer: transfer(clusterId) });
    saved = JSON.parse(localStorage.getItem(mapKey) || '{}');
    expect(saved.nodes.find((node: { id: string }) => node.id === clusterId).parentId).toBe(pillarId);

    fireEvent.dragStart(screen.getByRole('button', { name: 'Temat: Pillar' }), { dataTransfer: transfer(pillarId) });
    fireEvent.drop(screen.getByRole('button', { name: 'Temat: Cluster' }), { dataTransfer: transfer(pillarId) });
    saved = JSON.parse(localStorage.getItem(mapKey) || '{}');
    expect(saved.nodes.find((node: { id: string }) => node.id === pillarId).parentId).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(i18n.t('semanticWorkspace.cannotCreateCycle'));

    fireEvent.drop(screen.getByLabelText('Upuść tutaj, aby przenieść temat na poziom główny'), { dataTransfer: transfer(clusterId) });
    saved = JSON.parse(localStorage.getItem(mapKey) || '{}');
    expect(saved.nodes.find((node: { id: string }) => node.id === clusterId).parentId).toBeNull();
  });

  it('offers non-crawled sitemap and content-link URLs as explicitly unverified plan candidates', () => {
    const contentUrl = 'https://example.com/coffee-guide';
    const chromeOnlyUrl = 'https://example.com/navigation-target';
    const sitemapUrl = 'https://example.com/sitemap-only';
    const pageWithCandidates = [{
      ...pages[0],
      semantic_links: [{ target_url: contentUrl, anchor_text: 'Coffee guide', is_internal: true }],
      links: [{ target_url: chromeOnlyUrl, anchor_text: 'Menu link', is_internal: true }],
    }] as unknown as CrawledPageSummary[];
    render(<SemanticTopicalWorkspace projectId="project-url-plan" pages={pageWithCandidates} graph={buildSemanticMap(pageWithCandidates, pages[0].url)} runId="run-url-plan" sitemapUrls={[sitemapUrl]} />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    fireEvent.change(screen.getByLabelText('Nazwa'), { target: { value: 'Coffee guide' } });

    fireEvent.click(screen.getByRole('checkbox', { name: `Przypisz URL ${contentUrl} do tematu Coffee guide` }));
    fireEvent.click(screen.getByRole('checkbox', { name: `Przypisz URL ${sitemapUrl} do tematu Coffee guide` }));

    expect(screen.getByText(i18n.t('semanticWorkspace.sourceContentLink'))).toBeTruthy();
    expect(screen.getByText(i18n.t('semanticWorkspace.sourceSitemap'))).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: `Przypisz URL ${chromeOnlyUrl} do tematu Coffee guide` })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: `Dodaj niezweryfikowany link wewnętrzny ${contentUrl}` }));
    expect(screen.getAllByText('plan topical · brak w bieżącym runie')).toHaveLength(2);
    expect(screen.getByText('Liczba celów linkowania spoza bieżącego crawl-run: 1')).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('seomi_project_project-url-plan_topical_map_v1') || '{}');
    expect(saved.nodes[0]).toMatchObject({ sourceUrls: [contentUrl, sitemapUrl], contentBrief: { internalLinkTargets: [contentUrl] } });
  });

  it('does not offer an unscoped plan when no project is active', () => {
    render(<SemanticTopicalWorkspace projectId={null} pages={pages} graph={buildSemanticMap(pages, pages[0].url)} runId="run-1" />);
    expect(screen.getByText(/Wybierz lub utwórz projekt/)).toBeTruthy();
  });

  it('opens semantic audit, compares against a saved baseline run and remembers the audit tab per project', () => {
    const currentPages = [{ ...pages[0], semantic_terms: ['coffee', 'fresh'] }] as unknown as CrawledPageSummary[];
    const baseline = { id: 'run-old', completedAt: '2026-09-20T10:00:00.000Z', startUrl: pages[0].url, config: {}, result: { pages_crawled: 1, pages } } as never;
    const props = { projectId: 'project-semantic-audit', pages: currentPages, graph: buildSemanticMap(currentPages, pages[0].url), runId: 'run-new', currentRunId: 'run-new', runs: [baseline] };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Audyt semantyczny' }));

    expect(screen.getByText('Pokrycie i ryzyka tematyczne')).toBeTruthy();
    expect(screen.getByLabelText('Bazowy crawl-run dla audytu semantycznego')).toBeTruthy();
    expect(screen.getByText('Zmieniły się terminy widoczne w treści')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-semantic-audit_topical_workspace_preferences_v1') || '{}').view).toBe('audit');

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('tab', { name: 'Audyt semantyczny' }).getAttribute('aria-selected')).toBe('true');
  });

  it('shows the evidence-qualified entity graph and remembers the graph tab', () => {
    const props = { projectId: 'project-entity-graph', pages, graph: buildSemanticMap(pages, pages[0].url), runId: 'run-entity' };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);

    fireEvent.change(screen.getByLabelText('Encja / marka'), { target: { value: 'Coffee' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Graf encji' }));

    expect(screen.getByRole('heading', { name: 'Graf dowodów encji' })).toBeTruthy();
    expect(screen.getByRole('img', { name: `${i18n.t('componentUi.entityGraph')} Coffee` })).toBeTruthy();
    expect(screen.getByText('snapshot projektu')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-entity-graph_topical_workspace_preferences_v1') || '{}').view).toBe('entity');

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('tab', { name: 'Graf encji' }).getAttribute('aria-selected')).toBe('true');
  });

  it('renders structured-data evidence as a separate graph layer', () => {
    const schemaPages = [{ ...pages[0], schema_types: ['https://schema.org/Organization'] }] as unknown as CrawledPageSummary[];
    render(<SemanticTopicalWorkspace projectId="project-entity-schema" pages={schemaPages} graph={buildSemanticMap(schemaPages, schemaPages[0].url)} runId="run-entity-schema" />);

    fireEvent.change(screen.getByLabelText('Encja / marka'), { target: { value: 'Coffee' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Graf encji' }));

    expect(screen.getByText('TYPY SCHEMATU')).toBeTruthy();
    expect(screen.getByText('Organization')).toBeTruthy();
    expect(screen.getByText('przerywana · dane strukturalne')).toBeTruthy();
    expect(screen.getByText('1 typów schematu')).toBeTruthy();
  });

  it('generates evidence-qualified JSON-LD from a selected crawled page and persists schema preferences per project', () => {
    const schemaPage = {
      ...pages[0],
      url: 'https://example.com/guides/coffee',
      final_url: 'https://example.com/guides/coffee',
      title: 'Coffee guide',
      meta_description: 'A practical coffee guide.',
      schema_types: ['https://schema.org/NewsArticle'],
    } as unknown as CrawledPageSummary;
    const props = {
      projectId: 'project-schema-ui',
      pages: [schemaPage],
      graph: buildSemanticMap([schemaPage], schemaPage.url),
      runId: 'run-schema-ui',
    };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Schemat JSON-LD' }));
    fireEvent.change(screen.getByLabelText('Strona dla schematu JSON-LD'), {
      target: { value: schemaPage.url },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dodaj breadcrumbs z adresu URL' }));
    fireEvent.change(screen.getByLabelText('Wykryty typ artykułu dla schematu'), {
      target: { value: 'NewsArticle' },
    });

    const preview = screen.getByText(/"@context": "https:\/\/schema.org"/).textContent || '';
    expect(preview).toContain('BreadcrumbList');
    expect(preview).toContain('NewsArticle');
    expect(preview).toContain('Coffee guide');
    expect(JSON.parse(localStorage.getItem('seomi_project_project-schema-ui_topical_workspace_preferences_v1') || '{}')).toMatchObject({
      view: 'schema',
      schemaUrl: schemaPage.url,
      includeSchemaBreadcrumbs: true,
      schemaArticleType: 'NewsArticle',
    });

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('tab', { name: 'Schemat JSON-LD' }).getAttribute('aria-selected')).toBe('true');
    expect((screen.getByLabelText('Dodaj breadcrumbs z adresu URL') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Wykryty typ artykułu dla schematu') as HTMLSelectElement).value).toBe('NewsArticle');
  });

  it('shows evidence-qualified internal link candidates and remembers the link tab per project', () => {
    const linkPages = [
      pages[0],
      { ...pages[0], url: 'https://example.com/b', final_url: 'https://example.com/b', title: 'B' },
    ] as CrawledPageSummary[];
    const props = { projectId: 'project-link-opportunities', pages: linkPages, graph: buildSemanticMap(linkPages, pages[0].url), runId: 'run-links' };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Linki wewnętrzne' }));
    expect(screen.getByRole('heading', { name: 'Kandydaci do linkowania wewnętrznego' })).toBeTruthy();
    expect(screen.getByText('2', { selector: '.text-lg' })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('seomi_project_project-link-opportunities_topical_workspace_preferences_v1') || '{}').view).toBe('links');

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('tab', { name: 'Linki wewnętrzne' }).getAttribute('aria-selected')).toBe('true');
  });

  it('persists an evidence-aware brief and prevents a drafted lifecycle after its gates regress', () => {
    const graph = buildSemanticMap(pages, pages[0].url);
    render(<SemanticTopicalWorkspace projectId="project-brief" pages={pages} graph={graph} runId="run-brief" />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    fireEvent.change(screen.getByLabelText(i18n.t('semanticWorkspace.manualQueriesAria')), { target: { value: 'coffee guide' } });
    const initial = JSON.parse(localStorage.getItem('seomi_project_project-brief_topical_map_v1') || '{}');
    const queryId = initial.nodes[0].queries[0].id;

    fireEvent.change(screen.getByLabelText('Główne zapytanie briefu'), { target: { value: queryId } });
    fireEvent.change(screen.getByLabelText('Docelowy snippet briefu'), { target: { value: 'definition' } });
    fireEvent.change(screen.getByLabelText('Wymagane encje briefu'), { target: { value: 'coffee' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dodaj link wewnętrzny https://example.com/a' }));
    fireEvent.change(screen.getByLabelText('Szkic treści'), { target: { value: 'A coffee guide for careful readers.' } });
    fireEvent.change(screen.getByLabelText('Notatka wersji szkicu'), { target: { value: 'wersja źródłowa' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('contentBrief.saveVersion') }));
    const versioned = JSON.parse(localStorage.getItem('seomi_project_project-brief_topical_map_v1') || '{}');
    expect(versioned.nodes[0].contentBrief.draftVersions).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(i18n.t('contentBrief.classification')), { target: { value: 'source-backed' } });
    fireEvent.change(screen.getByLabelText(i18n.t('contentBrief.sourceUrl')), { target: { value: 'https://example.com/editorial-source' } });
    fireEvent.click(screen.getByLabelText(i18n.t('contentBrief.confirmSourceAria', { index: 1 })));
    fireEvent.click(screen.getByRole('button', { name: i18n.t('contentBrief.markDraft') }));

    let saved = JSON.parse(localStorage.getItem('seomi_project_project-brief_topical_map_v1') || '{}');
    expect(saved.nodes[0]).toMatchObject({
      lifecycle: 'drafted',
      contentBrief: { targetQueryId: queryId, requiredEntities: ['coffee'], snippetTarget: 'definition', internalLinkTargets: ['https://example.com/a'], draftMarkdown: 'A coffee guide for careful readers.', paragraphReviews: [{ paragraph: 'A coffee guide for careful readers.', treatment: 'source-backed', sourceUrl: 'https://example.com/editorial-source', sourceChecked: true }] },
    });

    fireEvent.change(screen.getByLabelText(i18n.t('contentBrief.draftAria')), { target: { value: 'A careful guide for readers.' } });
    saved = JSON.parse(localStorage.getItem('seomi_project_project-brief_topical_map_v1') || '{}');
    expect(saved.nodes[0].lifecycle).toBe('briefed');
    expect(screen.getByRole('status', { name: i18n.t('contentBrief.diffAria') }).textContent).toContain('+1 linii');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('contentBrief.restoreVersion') }));
    expect((screen.getByLabelText(i18n.t('contentBrief.draftAria')) as HTMLTextAreaElement).value).toBe('A coffee guide for careful readers.');
  });

  it('imports DataForSEO and GSC queries with evidence and preserves provenance during textarea edits', () => {
    useToolsStore.setState({
      keywordResults: [{ keyword: 'coffee grinder', search_volume: 2400, cpc: 1.2, competition: 0.3, difficulty: 30, intent: 'Informational', trend: [2200], sourceMetrics: { searchVolume: 2400, cpc: 1.2, competitionIndex: 30, intent: 'informational', monthlySearches: [{ year: 2026, month: 8, searchVolume: 2200 }] } }],
      keywordResultsSource: { seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl', retrievedAt: '2026-09-23T10:00:00.000Z' },
      gscProperty: 'sc-domain:example.com',
      gscDataFetchedAt: '2026-09-23T11:00:00.000Z',
      gscData: { site_url: 'sc-domain:example.com', start_date: '2026-08-01', end_date: '2026-08-31', total_clicks: 4, total_impressions: 80, avg_ctr: 0.05, avg_position: 7, queries: [{ query: 'coffee beans', clicks: 4, impressions: 80, ctr: 0.05, position: 7 }], pages: [], daily: [], queries_may_be_truncated: true, pages_may_be_truncated: false, daily_may_be_truncated: false, max_rows_per_dimension: 1000 },
    });
    render(<SemanticTopicalWorkspace projectId="project-evidence" pages={pages} graph={buildSemanticMap(pages, pages[0].url)} runId="run-evidence" />);
    fireEvent.click(screen.getByRole('button', { name: '＋ Temat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importuj zapytania z DataForSEO' }));
    fireEvent.click(screen.getByRole('button', { name: 'Importuj zapytania z Google Search Console' }));

    let saved = JSON.parse(localStorage.getItem('seomi_project_project-evidence_topical_map_v1') || '{}');
    expect(saved.nodes[0].queries).toMatchObject([
      { text: 'coffee grinder', provenance: 'dataforseo', source: { countryCode: 'PL', locationCode: 2616, languageCode: 'pl', searchVolume: 2400, competitionIndex: 30 } },
      { text: 'coffee beans', provenance: 'gsc', source: { propertyUrl: 'sc-domain:example.com', startDate: '2026-08-01', queryRowsMayBeTruncated: true, impressions: 80 } },
    ]);
    const textarea = screen.getByLabelText(i18n.t('semanticWorkspace.manualQueriesAria'));
    fireEvent.change(textarea, { target: { value: 'coffee filter' } });
    saved = JSON.parse(localStorage.getItem('seomi_project_project-evidence_topical_map_v1') || '{}');
    expect(saved.nodes[0].queries.map((query: { provenance: string }) => query.provenance)).toEqual(['dataforseo', 'gsc', 'asserted']);
    const truncatedNotice = i18n.t('semanticWorkspace.truncatedRows', { count: 1000 });
    expect(screen.getAllByText((_, element) => Boolean(element?.textContent?.includes(truncatedNotice))).length).toBeGreaterThan(0);
  });

  it('persists calendar view and filters per project and creates a topical node on a chosen date', () => {
    const props = { projectId: 'project-calendar', pages, graph: buildSemanticMap(pages, pages[0].url), runId: 'run-calendar' };
    const mounted = render(<SemanticTopicalWorkspace {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Kalendarz' }));
    const preferencesKey = 'seomi_project_project-calendar_topical_workspace_preferences_v1';
    const originalMonth = JSON.parse(localStorage.getItem(preferencesKey) || '{}').month as string;
    const nextMonth = shiftTopicalCalendarMonth(originalMonth, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Następny miesiąc' }));
    fireEvent.change(screen.getByLabelText('Filtruj etap kalendarza'), { target: { value: 'published' } });
    expect(JSON.parse(localStorage.getItem(preferencesKey) || '{}')).toMatchObject({ view: 'calendar', month: nextMonth, filters: { lifecycle: 'published' } });

    mounted.unmount();
    render(<SemanticTopicalWorkspace {...props} />);
    expect(screen.getByRole('region', { name: 'Kalendarz topical planu' })).toBeTruthy();
    expect((screen.getByLabelText('Filtruj etap kalendarza') as HTMLSelectElement).value).toBe('published');
    fireEvent.click(screen.getByRole('button', { name: `Dodaj temat na ${nextMonth}-15` }));
    const saved = JSON.parse(localStorage.getItem('seomi_project_project-calendar_topical_map_v1') || '{}');
    expect(saved.nodes[0]).toMatchObject({ scheduledDate: `${nextMonth}-15`, lifecycle: 'planned' });
  });
});
