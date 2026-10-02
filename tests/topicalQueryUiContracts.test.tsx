import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopicalQueryEvidenceEditor } from '@/components/Charts/semanticTopical/TopicalQueryEvidenceEditor';
import { QueryImportControls } from '@/components/Charts/semanticTopical/editor/QueryImportControls';
import { QueryEvidenceList } from '@/components/Charts/semanticTopical/editor/QueryEvidenceList';
import type { DataForSeoTopicalEvidence, GscTopicalEvidence } from '@/services/topicalMap';
import { topicalSession } from './fixtures/topicalSessionContracts';
import { gscData } from './fixtures/gscTracker';

const ads: DataForSeoTopicalEvidence = {
  provider: 'DataForSEO Google Ads Keywords for Keywords Live', retrievedAt: 'now', seedKeyword: 'coffee', countryCode: 'PL',
  locationCode: 2616, languageCode: 'pl', searchVolume: 0, cpc: 5, competitionIndex: null, searchIntent: null, monthlySearches: [],
};
const gsc: GscTopicalEvidence = {
  provider: 'Google Search Console', retrievedAt: 'now', propertyUrl: 'sc-domain:site.test', startDate: '2026-09-01',
  endDate: '2026-09-30', clicks: 0, impressions: 5, ctr: 0.1, position: 11.23, queryRowsMayBeTruncated: true, maxRowsPerDimension: 1000,
};
const source = { seedKeyword: 'coffee', countryCode: 'PL', locationCode: 2616, languageCode: 'pl', retrievedAt: 'now' };
const result = { keyword: 'coffee', search_volume: 0, cpc: 0, competition: 0, difficulty: 0, intent: 'Informational' as const, trend: [] };

describe('topical query UI contracts', () => {
  it('edits only asserted query text and retains all source evidence separately', () => {
    const session = topicalSession({ queryImportNotice: 'Imported observations' });
    session.selectedNode!.queries = [{ id: 'manual', text: 'manual phrase', provenance: 'asserted' }, { id: 'gsc', text: 'observed phrase', provenance: 'gsc', source: gsc }];
    const { rerender } = render(<TopicalQueryEvidenceEditor session={session} />);
    const input = screen.getByLabelText('semanticWorkspace.manualQueriesAria') as HTMLTextAreaElement;
    expect(input.value).toBe('manual phrase');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('Imported observations');
    expect(screen.getByText('semanticWorkspace.noQuerySource')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'edited manual phrase' } });
    expect(session.updateManualQueries).toHaveBeenCalledWith('edited manual phrase');
    rerender(<TopicalQueryEvidenceEditor session={{ ...session, keywordResultsSource: source, queryImportNotice: '' }} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('semanticWorkspace.noQuerySource')).toBeNull();
    rerender(<TopicalQueryEvidenceEditor session={{ ...session, selectedNode: null }} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('imports only available, retrieved provider snapshots and disables busy imports', () => {
    const session = topicalSession();
    const { rerender } = render(<QueryImportControls session={session} />);
    const adsButton = screen.getByRole('button', { name: 'semanticWorkspace.importDataForSeoAria' }) as HTMLButtonElement;
    const gscButton = screen.getByRole('button', { name: 'semanticWorkspace.importGscAria' }) as HTMLButtonElement;
    expect(adsButton.disabled).toBe(true);
    expect(gscButton.disabled).toBe(true);
    const ready = { ...session, keywordResultsSource: source, keywordResults: [result], gscData: gscData(), gscDataFetchedAt: 'now' };
    rerender(<QueryImportControls session={{ ...ready, keywordResults: [], gscDataFetchedAt: null }} />);
    expect(adsButton.disabled).toBe(true);
    expect(gscButton.disabled).toBe(true);
    rerender(<QueryImportControls session={{ ...ready, isKeywordLoading: true, gscData: gscData({ queries: [] }) }} />);
    expect(adsButton.disabled).toBe(true);
    expect(gscButton.disabled).toBe(true);
    rerender(<QueryImportControls session={ready} />);
    expect(adsButton.disabled).toBe(false);
    expect(gscButton.disabled).toBe(false);
    fireEvent.click(adsButton); fireEvent.click(gscButton);
    expect(session.importQueryEvidence).toHaveBeenCalledWith('dataforseo');
    expect(session.importQueryEvidence).toHaveBeenCalledWith('gsc');
  });
  it('preserves zero/unavailable metrics, exact source windows and truncation disclosures', () => {
    const metric = vi.fn((value: number | null) => value === null ? 'unavailable' : String(value));
    const session = topicalSession({ sourceMetric: metric });
    session.selectedNode!.queries = [
      { id: 'a', text: 'ads unknown intent', provenance: 'dataforseo', source: ads },
      { id: 'b', text: 'ads known intent', provenance: 'dataforseo', source: { ...ads, searchIntent: 'informational' } },
      { id: 'c', text: 'gsc limited', provenance: 'gsc', source: gsc },
      { id: 'd', text: 'gsc complete', provenance: 'gsc', source: { ...gsc, queryRowsMayBeTruncated: false } },
      { id: 'e', text: 'manual', provenance: 'asserted' },
    ];
    const { rerender } = render(<QueryEvidenceList session={session} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0].textContent).toContain('semanticWorkspace.searchVolume: 0');
    expect(items[0].textContent).toContain('semanticWorkspace.noValue');
    expect(items[1].textContent).toContain('informational');
    expect(items[2].textContent).toContain('2026-09-01–2026-09-30');
    expect(items[2].textContent).toContain('10.00%');
    expect(items[2].textContent).toContain('11.2');
    expect(items[2].textContent).toContain('semanticWorkspace.truncatedRows:1000');
    expect(items[3].textContent).not.toContain('semanticWorkspace.truncatedRows');
    expect(items[4].textContent).toContain('semanticWorkspace.asserted');
    expect(metric).toHaveBeenCalledWith(null);
    expect(metric).toHaveBeenCalledWith(0);
    rerender(<QueryEvidenceList session={{ ...session, selectedNode: null }} />);
    expect(screen.queryByRole('list')).toBeNull();
  });
});
