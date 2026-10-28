import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CrawledPageSummary, CrawledSchemaReference, CrawlRunRecord } from '@/types';
import { createCrawlPageFixture } from './fixtures/crawl';

const monitor = vi.hoisted(() => vi.fn());
const scores = vi.hoisted(() => ({ aio: 80 }));
vi.mock('@/services/monitoringAlerts', () => ({ monitorScoreDrop: monitor }));
vi.mock('@/services/siteFocus', () => ({ buildSiteFocusReport: () => ({ pages: [], coreTopic: { label: '', terms: [] }, model: { language: 'en', coreWeights: {} } }) }));
vi.mock('@/services/aioReadiness', async (importActual) => ({
  ...(await importActual<typeof import('@/services/aioReadiness')>()),
  buildAioReport: () => ({ generatedAt: 't', score: scores.aio, selfContainment: 1, spoDensity: 1, extractability: 1, scoredCount: 1, weakPassages: [] }),
}));

import { useAioReadiness } from '@/hooks/useAioReadiness';
import { useTrust } from '@/hooks/useTrust';
import { trustHistoryKey } from '@/services/eeatTrust';

type SchemaRef = CrawledSchemaReference & { node_path?: string };
const schemaRef = (node_path: string, property: string, value: string, declaration_index = 0): SchemaRef => ({ format: 'JSON-LD', declaration_index, node_path, property, value });
const trustPages = (withEvidence: boolean): CrawledPageSummary[] => [createCrawlPageFixture({
  url: 'https://a.test/article', final_url: 'https://a.test/article', title: 'Diabetes treatment',
  ...(withEvidence ? {
    schema_types: ['Article'],
    schema_references: [
      schemaRef('$', '@type', 'Article'),
      schemaRef('$', 'author', 'https://a.test/authors/anna'),
      schemaRef('$', 'dateModified', '2026-01-01'),
      schemaRef('$.author', '@id', 'https://a.test/authors/anna'),
      schemaRef('$.author', '@type', 'Person'),
      schemaRef('$.author', 'name', 'Anna Nowak'),
      schemaRef('$.author', 'description', 'Diabetes physician'),
    ],
  } : { schema_references: [schemaRef('$', '@type', 'Article')] }),
})];
const pages = trustPages(true);
const run = (id: string) => ({ id, completedAt: '2026-01-01' }) as unknown as CrawlRunRecord;

describe('score drop monitoring in hooks', () => {
  beforeEach(() => {
    localStorage.clear();
    monitor.mockReset();
    monitor.mockResolvedValue({});
    scores.aio = 80;
  });

  it('AIO: records snapshots but leaves alerting to crawl completion, not panel history', () => {
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
    scores.aio = 60;
    const { result } = renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'));
    expect(result.current.history.map((item) => item.score)).toEqual([80, 60]);
    expect(monitor).not.toHaveBeenCalled();
    monitor.mockClear();
    renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
  });

  it('AIO: does not alert when an older run is opened after a newer run', () => {
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    scores.aio = 10;
    expect(() => renderHook(() => useAioReadiness(pages, run('r2'), 'proj-1'))).not.toThrow();
    renderHook(() => useAioReadiness(pages, run('r1'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
  });

  it('Trust: keeps first run and mixed profiles quiet, then alerts a comparable drop once', () => {
    const first = renderHook(() => useTrust(trustPages(true), 'https://a.test/', run('r1'), 'proj-1'));
    expect(monitor).not.toHaveBeenCalled();
    first.unmount();

    localStorage.setItem(trustHistoryKey('mixed-proj'), JSON.stringify([{ at: '2026-01-01', runId: 'legacy', score: 80, layers: { schemaGraph: 80 } }]));
    const mixed = renderHook(() => useTrust(trustPages(false), 'https://a.test/', run('mixed'), 'mixed-proj'));
    expect(monitor).not.toHaveBeenCalled();
    mixed.unmount();

    monitor.mockClear();
    const second = renderHook(() => useTrust(trustPages(false), 'https://a.test/', run('r2'), 'proj-1'));
    expect(monitor).toHaveBeenCalledWith('proj-1', 'trust', expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), expect.objectContaining({ profileId: 'eetv-5-layer-v2' }), 'r2');
    expect(monitor.mock.calls[0][2].score).toBeGreaterThan(monitor.mock.calls[0][3].score);
    monitor.mockClear();
    second.unmount();
    const duplicate = renderHook(() => useTrust(trustPages(false), 'https://a.test/', run('r2'), 'proj-1'));
    const missingProject = renderHook(() => useTrust(trustPages(false), 'https://a.test/', run('r3'), null));
    expect(monitor).not.toHaveBeenCalled();
    duplicate.unmount();
    missingProject.unmount();
  });
});
