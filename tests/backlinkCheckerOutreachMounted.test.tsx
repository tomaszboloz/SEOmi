import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import type { BacklinkGapReport } from '@/types';

const produce = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/services/outreachCopilot/igosProducer', () => ({ produceInformationGain: produce }));
vi.mock('@/components/Domain/backlinkChecker/useBacklinkSession', () => ({ useBacklinkSession: () => session.current }));
vi.mock('@/components/Domain/backlinkChecker/BacklinkHeader', () => ({ BacklinkHeader: () => null }));
vi.mock('@/components/Domain/backlinkChecker/BacklinkGapSection', () => ({ BacklinkGapSection: () => null }));
vi.mock('@/components/DataForSEO/cost/DataForSeoCostMeter', () => ({ DataForSeoCostMeter: () => null }));

import { BacklinkChecker } from '@/components/Domain/BacklinkChecker';

const gap: BacklinkGapReport = { target: 'me.com', competitors: ['a.com'], include_subdomains: false, total_rows: 1, rows_scanned: 1, opportunities: [{ referring_domain: 'blog.example', target_backlinks: 0, competitor_backlinks: [{ domain: 'a.com', backlinks: 3, rank: 50 }], max_competitor_spam_score: null }] };
const igos = {
  status: 'ready', igos: 80, components: null, coverage: null, multiplier: null, onTopicShare: 1, availableDocs: 3, requestedDocs: 3, novelEntities: ['local study'], limitations: [],
  zones: [{ chunk: { text: 'new', offset: 0, heading: null, vector: new Float64Array([1]) }, topic: 0.8, nearest: 0.2, zone: 'gain', evidence: { url: 'https://competitor.example/source', rank: 1, passageIndex: 0 } }],
};
const produced = (projectId: string) => ({ projectId, site: 'https://me.com', report: igos, source: { title: 'Study', url: 'https://me.com/study', summary: 'Observed data.' }, provenance: { provider: 'local-hash', model: 'hash-1024-n345', approximation: 'local-lexical', observedAt: null } });
const setSession = (patch: Record<string, unknown>) => { session.current = { t: (key: string) => key, activeProjectId: 'p1', siteUrl: 'https://me.com', backlinkGapReport: gap, crawlPages: [{ url: 'https://me.com/study' }], backlinkProfile: null, ...patch }; };

beforeEach(() => { produce.mockReset(); setSession({}); });

describe('BacklinkChecker outreach acceptance (#143)', () => {
  it('derives a personalized draft from the mounted production hook with disclosed provenance', async () => {
    produce.mockResolvedValue(produced('p1'));
    render(<BacklinkChecker />);
    fireEvent.click(await screen.findByRole('button', { name: 'Show draft' }));
    expect(screen.getByTestId('outreach-draft').textContent).toContain('Study');
    expect(screen.getByTestId('outreach-provenance').textContent).toContain('hash-1024-n345');
    expect(screen.getByTestId('outreach-evidence').textContent).toContain('https://competitor.example/source');
  });

  it('offers no draft when the producer has no usable data', async () => {
    produce.mockResolvedValue(null);
    render(<BacklinkChecker />);
    await waitFor(() => expect(produce).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Show draft' })).toBeNull();
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy();
  });

  it('never shows evidence produced for another project', async () => {
    produce.mockResolvedValue(produced('other'));
    render(<BacklinkChecker />);
    await waitFor(() => expect(produce).toHaveBeenCalled());
    expect(screen.queryByTestId('outreach-evidence')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show draft' })).toBeNull();
  });

  it('does not run the producer without a crawl, and honors an injected source', () => {
    setSession({ crawlPages: [] });
    const view = render(<BacklinkChecker />);
    expect(produce).not.toHaveBeenCalled();
    view.rerender(<BacklinkChecker informationGain={produced('p1') as never} />);
    expect(screen.getByRole('button', { name: 'Show draft' })).toBeTruthy();
    expect(produce).not.toHaveBeenCalled();
  });
});
