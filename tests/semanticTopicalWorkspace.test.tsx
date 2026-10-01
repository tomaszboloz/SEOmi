import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SemanticTopicalWorkspace } from '@/components/Charts/SemanticTopicalWorkspace';
import { buildSemanticMap } from '@/services/semanticMap';
import { useToolsStore } from '@/stores/toolsStore';

import type { CrawledPageSummary } from '@/types';
import i18n from '@/i18n';
import { pages } from "./fixtures/semanticTopicalWorkspaceContracts";

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
});
