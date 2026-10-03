import { readFileSync, readdirSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { TopicalQueryEvidenceEditor } from '@/components/Charts/semanticTopical/TopicalQueryEvidenceEditor';
import { topicalSession } from './fixtures/topicalSessionContracts';

it('labels a DataForSEO CPC observation exactly once', () => {
  const session = topicalSession({ keywordResults: [], keywordResultsSource: null, isKeywordLoading: false,
    gscData: null, gscDataFetchedAt: null, queryImportNotice: '', importQueryEvidence: vi.fn(),
    sourceMetric: (value) => value === null ? 'unavailable' : String(value) });
  session.selectedNode!.queries = [{ id: 'q', text: 'coffee', provenance: 'dataforseo', source: {
    provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt: 'now', seedKeyword: 'coffee',
    countryCode: 'PL', locationCode: 2616, languageCode: 'pl', searchVolume: 0, cpc: 5,
    competitionIndex: null, searchIntent: null, monthlySearches: [],
  } }];
  render(<TopicalQueryEvidenceEditor session={session} />);
  const evidence = screen.getByRole('listitem').textContent!;
  expect(evidence.match(/semanticWorkspace\.cpc/g)).toHaveLength(1);
  expect(evidence).toContain('semanticWorkspace.cpc: 5');
});

it('keeps topical editor responsibilities within 150 physical lines', () => {
  const base = 'src/components/Charts/semanticTopical/';
  const facadeNames = ['TopicalEntityEditor.tsx', 'TopicalCrawlEvidence.tsx', 'TopicalNodeMetadata.tsx', 'TopicalQueryEvidenceEditor.tsx'];
  const files = [...facadeNames.map((name) => base + name), ...readdirSync(base + 'editor').map((name) => base + 'editor/' + name)];
  for (const file of files) expect(readFileSync(file, 'utf8').split('\n').length - 1, file).toBeLessThanOrEqual(150);
});
