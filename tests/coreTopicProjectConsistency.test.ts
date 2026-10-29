import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrawlRunRecord } from '@/types';
import { buildSiteFocusReport } from '@/services/siteFocus';
import { runTaskVerification } from '@/services/optimizationTasks/runVerification';
import { writeTasks } from '@/services/optimizationTasks/storage';
import type { OptimizationTask } from '@/services/optimizationTasks/types';
import { writeAnchorUrls } from '@/services/siteFocusMonitoring/anchors';
import { writeManualTopic } from '@/services/siteFocusMonitoring/topic';
import { gatedSiteFocus } from '@/services/topicalAuthority/context';
import { coffeePage, NOW } from './authorityFixtures';

vi.mock('@/services/siteFocus', async (original) => ({
  ...await original<typeof import('@/services/siteFocus')>(), buildSiteFocusReport: vi.fn(),
}));

const actual = await vi.importActual<typeof import('@/services/siteFocus')>('@/services/siteFocus');
const start = 'https://core.test/';
const pages = [coffeePage('core.test', { path: '/coffee', title: 'Coffee espresso', date: '2026-09-01' })];
const report = actual.buildSiteFocusReport(pages, start, { now: NOW });
const rebuild = vi.mocked(buildSiteFocusReport);
const OFFER = 'https://core.test/offer';

beforeEach(() => {
  localStorage.clear();
  rebuild.mockReset().mockReturnValue(report);
});

describe('one Core Topic per project across modules (#82)', () => {
  it('verifies tasks with the same saved topic and anchors as the Focus baseline', () => {
    writeManualTopic('p', 'espresso machines');
    writeAnchorUrls('p', [OFFER]);
    const task: OptimizationTask = {
      id: 't', kind: 'remove-noindex', module: 'sfs', status: 'implemented', url: pages[0].url,
      baselineScore: 50, priority: 'medium', createdAt: '2026-10-24T00:00:00Z', implementedAt: '2026-10-24T01:00:00Z',
    };
    writeTasks('p', [task]);
    const run = { startedAt: '2026-10-24T05:00:00Z', completedAt: '2026-10-24T05:01:00Z', status: 'completed', result: { start_url: start, pages } } as unknown as CrawlRunRecord;
    runTaskVerification('p', run);
    expect(rebuild).toHaveBeenCalledWith(pages, start, { manualTopic: 'espresso machines', anchorUrls: [OFFER] });
  });

  it('keeps the requested anchors when TAS rebuilds the gated model', () => {
    const anchored = { ...report, coreTopic: { ...report.coreTopic, anchors: { sources: [start], missing: [OFFER], applied: true } } };
    gatedSiteFocus(pages, start, anchored);
    expect(rebuild).toHaveBeenCalledWith(pages, start, expect.objectContaining({ anchorUrls: [start, OFFER] }));
  });

  it('adds no anchors when the report was built without them', () => {
    gatedSiteFocus(pages, start, report);
    expect(rebuild.mock.calls[0][2]).not.toHaveProperty('anchorUrls');
  });
});
