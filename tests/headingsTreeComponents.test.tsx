import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { HeadingsTree } from '@/components/Results/HeadingsTree';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import type { PageAuditData } from '@/types';
import i18n from '@/i18n';

const auditWithIssues: PageAuditData = {
  url: 'https://example.com/blog',
  final_url: 'https://example.com/blog',
  timestamp: '2026-10-01T00:00:00.000Z',
  http_status: 200,
  response_time_ms: 80,
  redirect_chain: [],
  meta_tags: { title: 'Blog', title_length: 4, description: 'Blog desc', description_length: 9, other_tags: [] },
  open_graph: { all_tags: [] },
  twitter_card: { all_tags: [] },
  headings: {
    h1_count: 2,
    h1_texts: ['First H1', 'Second H1'],
    hierarchy: [
      { level: 1, text: 'First H1', children: [{ level: 3, text: 'Skipped H2 to H3', children: [] }] },
    ],
    has_valid_hierarchy: false,
    issues: ['Multiple H1 headings detected', 'Heading level skipped from H1 to H3'],
  },
  images: [],
  links: { total_links: 0, internal_links: 0, external_links: 0, nofollow_links: 0, links: [] },
  security_headers: { score: 85 },
  structured_data: [],
  technical: { hreflang_tags: [] },
  health_score: 70,
  issues: [],
  content_stats: { word_count: 50, reading_time_minutes: 1, text_ratio_percent: 15, top_keywords: [], body_text: 'Text' },
};

describe('HeadingsTree components architecture and rendering', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
    useProjectStore.setState({ projects: [], activeProjectId: null });
    useAuditStore.setState({ showOnlyProblems: false });
  });

  it('keeps HeadingsTree and its submodules strictly <= 150 LOC', () => {
    const files = [
      'src/components/Results/HeadingsTree.tsx',
      'src/components/Results/headingsTree/headingsTreeTypes.ts',
      'src/components/Results/headingsTree/HeadingsSummaryCards.tsx',
      'src/components/Results/headingsTree/HeadingsIssuesCallout.tsx',
      'src/components/Results/headingsTree/HeadingsKeyphraseSection.tsx',
      'src/components/Results/headingsTree/HeadingsTreeView.tsx',
    ];
    for (const rel of files) {
      const fullPath = path.resolve(process.cwd(), rel);
      const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
      expect(lines).toBeLessThanOrEqual(150);
    }
  });

  it('renders summary cards, issues callout, and headings tree view', () => {
    render(<HeadingsTree audit={auditWithIssues} />);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Multiple H1 headings detected')).toBeDefined();
    expect(screen.getByText('First H1')).toBeDefined();
    expect(screen.getByText('Skipped H2 to H3')).toBeDefined();
  });

  it('renders problem-only state properly when showOnlyProblems is enabled', () => {
    useAuditStore.setState({ showOnlyProblems: true });
    render(<HeadingsTree audit={auditWithIssues} />);
    expect(screen.getByText('Multiple H1 headings detected')).toBeDefined();
    expect(screen.queryByText('First H1')).toBeNull();
  });
});
