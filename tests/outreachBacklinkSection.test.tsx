import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BacklinkOutreachSection } from '@/components/Domain/backlinkChecker/BacklinkOutreachSection';
import { downloadBlob } from '@/services/download';
import type { BacklinkGapReport } from '@/types';
import '@/i18n';

vi.mock('@/services/download', () => ({ downloadBlob: vi.fn() }));

const report: BacklinkGapReport = {
  target: 'site.test', competitors: ['a.test', 'b.test', 'c.test', 'outside.test'], include_subdomains: true,
  rows_scanned: 1, total_rows: 1,
  opportunities: [{ referring_domain: 'source.test', target_backlinks: 0, max_competitor_spam_score: null,
    competitor_backlinks: [
      { domain: 'a.test', backlinks: 1, rank: 90 }, { domain: 'b.test', backlinks: 1, rank: 80 },
      { domain: 'c.test', backlinks: 1, rank: 70 }, { domain: 'outside.test', backlinks: 1, rank: 100 },
    ] }],
};

const evidence = {
  reportId: 'igos:https://site.test/research:3:1:1',
  sourceUrl: 'https://site.test/research',
  novelEntities: ['methodology'],
  gainZones: 1,
  baselineDocs: 3,
  baselineProvenance: 'igos' as const,
};
const source = { title: 'Original research', url: 'https://site.test/research', summary: 'Verified source.', provenance: 'igos' as const, evidence };

describe('BacklinkOutreachSection', () => {
  it('uses the first three report competitors and exports the real rows', () => {
    render(<BacklinkOutreachSection report={report} igosReport={{ status: 'ready', igos: 65 }} sourceCandidates={[source]} />);
    expect(screen.getByText('source.test: priority 0.80, links to 3 competitors')).toBeTruthy();
    expect(screen.getByTestId('outreach-draft').textContent).toContain('Original research');
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(downloadBlob).toHaveBeenCalledOnce();
  });

  it('keeps the empty and unavailable states honest', () => {
    const { rerender } = render(<BacklinkOutreachSection report={null} />);
    expect(screen.getByText('No backlink gap data. Run a backlink gap check first.')).toBeTruthy();
    rerender(<BacklinkOutreachSection report={report} igosReport={{ status: 'off-topic', igos: null }} sourceCandidates={[source]} />);
    expect(screen.getByTestId('outreach-source-status').textContent).toContain('No verified IGOS source');
    expect(screen.queryByTestId('outreach-draft')).toBeNull();
  });
});
