import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { CrawlArchitectureControls } from '@/components/Charts/crawlArchitecture/CrawlArchitectureControls';
import { CrawlArchitectureSidebar } from '@/components/Charts/crawlArchitecture/CrawlArchitectureSidebar';
import { buildSimulationNodesAndLinks, HUB_COLOR, NO_TOPIC_COLOR } from '@/components/Charts/crawlArchitecture/CrawlArchitectureD3Helpers';
import { CLUSTER_COLORS, type SemanticMapPreferences } from '@/components/Charts/crawlArchitecture/CrawlArchitectureTypes';
import { buildTopicalDiagnosis } from '@/services/topicalDiagnosis';
import { createCrawlPageFixture } from './fixtures/crawl';

const link = (target_url: string) => ({ target_url, anchor_text: 'x', is_internal: true });
const page = (url: string, patch: Record<string, unknown> = {}) => createCrawlPageFixture({ url, final_url: url, semantic_language: 'pl', word_count: 800, hreflangs: [], ...patch });
const posts = ['a', 'b', 'c', 'd', 'e'].map((slug) => `https://ex.test/blog/${slug}/`);
const pages = [
  page('https://ex.test/blog/', { semantic_links: posts.map(link), word_count: 100, title: 'Blog | Ex' }),
  ...posts.map((url, index) => page(url, { title: `Post ${index}`, semantic_terms: index < 2 ? ['navigator', 'alerty', `x${index}`] : [`solo${index}`, 'inne'] })),
];
const report = buildTopicalDiagnosis(pages, 'https://ex.test/blog/');
const graph = { clusters: [{ id: 'c1', label: 'Cluster', pageCount: 2 }], nodes: [] };

describe('graph filtered and coloured by the diagnosis', () => {
  beforeEach(async () => { await i18n.changeLanguage('pl'); });

  it('shows the active diagnosis scope as a chip and clears it', () => {
    let latest: SemanticMapPreferences | null = null;
    const Harness = () => {
      const [preferences, setPreferences] = useState({ query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', diagnosisFilter: { kind: 'topic', id: report.topics[0].id } } as SemanticMapPreferences);
      latest = preferences;
      return <CrawlArchitectureControls preferences={preferences} setPreferences={setPreferences} graph={graph} scaleView={vi.fn()} resetView={vi.fn()} diagnosis={report} />;
    };
    render(<Harness />);
    expect(screen.getByText(`Zakres z diagnozy: ${report.topics[0].label}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż cały graf' }));
    expect(latest!.diagnosisFilter).toBeNull();
    expect(screen.queryByText(/Zakres z diagnozy/)).toBeNull();
  });

  it('names an area scope by its hub title and the no-hub area by its label', () => {
    const area = report.areas[0];
    const preferences = { query: '', clusterFilter: 'all', orphansOnly: false, linkMode: 'content', diagnosisFilter: { kind: 'area', id: area.id } } as SemanticMapPreferences;
    render(<CrawlArchitectureControls preferences={preferences} setPreferences={vi.fn()} graph={graph} scaleView={vi.fn()} resetView={vi.fn()} diagnosis={report} />);
    expect(screen.getByText('Zakres z diagnozy: Blog')).toBeTruthy();
  });

  it('colours nodes by topic, hubs light and topic-less documents grey', () => {
    const nodes = pages.map((candidate, index) => ({ id: `page-${index}`, clusterId: 'c1', page: candidate, semanticSignalCount: 3 }));
    const built = buildSimulationNodesAndLinks(nodes, [], [], graph, { positions: {} }, report);
    expect(built.nodes[0].color).toBe(HUB_COLOR);
    expect(built.nodes[1].color).toBe(CLUSTER_COLORS[0]);
    expect(built.nodes[2].color).toBe(CLUSTER_COLORS[0]);
    expect(built.nodes[3].color).toBe(NO_TOPIC_COLOR);
    expect(buildSimulationNodesAndLinks(nodes, [], [], graph, { positions: {} }).nodes[1].color).toBe(CLUSTER_COLORS[0]);
  });

  it('builds the legend from diagnosis topics when the report is present', () => {
    render(<CrawlArchitectureSidebar graph={graph} selectedNode={null} selectedId={null} selectedTopicEdges={[]} selectedOutboundEdges={[]} nodeById={new Map()} linkMode="content" crawlMode="http" diagnosis={report} />);
    expect(screen.getByText(`${report.topics[0].label} · 2`)).toBeTruthy();
    expect(screen.queryByText('Cluster · 2')).toBeNull();
  });
});
