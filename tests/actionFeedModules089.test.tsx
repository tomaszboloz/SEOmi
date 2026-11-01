import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutiveActionFeed } from '@/components/Domain/crawlResults/executive/ExecutiveActionFeed';
import i18n from '@/i18n';
import { aioActions, buildActionFeed, MODULE_ACTION_LIMIT, sprsActions, type ExecutiveAction } from '@/services/actionFeed';
import type { AioReport } from '@/services/aioReadiness';
import { buildExecutionCard } from '@/services/executionCard/fromAction';
import { computeHss } from '@/services/hss';
import type { SprsReport } from '@/services/semanticGraph/sprs';

vi.mock('@/services/tauri', () => ({ invokeTauriCommand: vi.fn() }));

const scope = { projectId: 'p', runId: 'r' };
const page = (nodeId: string, score: number, flags: Partial<SprsReport['pages'][number]> = {}) => ({ nodeId, score, probability: 0.1, inDegree: 1, outDegree: 1, deadEnd: false, underLinked: false, leak: false, ...flags });
const sprs = (pages: SprsReport['pages'], status: SprsReport['status'] = 'ready') => ({ status, pages, converged: true, iterations: 1, residual: 0, unknownSimilarityEdges: 0, unweightedZoneLinks: 0 }) as SprsReport;
const urls = new Map([['a', 'https://s.test/a'], ['b', 'https://s.test/b'], ['c', 'https://s.test/c']]);
const aioPage = (url: string, score: number, issues: string[] = ['no-entity']) => ({ url, score, weakChunks: issues.length ? [{ issues }, { issues: ['no-entity'] }] : [] });
const aio = (pages: unknown[], availability = 'complete') => ({ availability, pages }) as unknown as AioReport;

describe('SPRS and AIO-R actions in the feed (#89)', () => {
  it('SPRS: leak beats under-linked, worst score first, unknown nodes skipped, status gated', () => {
    const rows = sprs([page('a', 30, { leak: true, underLinked: true }), page('b', 10, { underLinked: true }), page('c', 90), page('zz', 1, { leak: true })]);
    const actions = sprsActions(scope, rows, urls);
    expect(actions.map((item) => [item.type, item.urls[0]])).toEqual([['sprs:add-inlinks', 'https://s.test/b'], ['sprs:fix-leak', 'https://s.test/a']]);
    expect(actions[0]).toMatchObject({ moduleDelta: null, drillTab: 'visualisations', blocked: false });
    const tie = sprs([page('c', 5, { leak: true }), page('a', 5, { leak: true })]);
    expect(sprsActions(scope, tie, urls).map((item) => item.urls[0])).toEqual(['https://s.test/a', 'https://s.test/c']);
    expect(sprsActions(scope, null, urls)).toEqual([]);
    expect(sprsActions(scope, sprs([], 'unavailable'), urls)).toEqual([]);
    const many = sprs(Array.from({ length: 30 }, (_, index) => page(`n${index}`, index, { leak: true })));
    const map = new Map(many.pages.map((item) => [item.nodeId, `https://s.test/${item.nodeId}`]));
    expect(sprsActions(scope, many, map)).toHaveLength(MODULE_ACTION_LIMIT);
  });

  it('AIO-R: pages with weak passages, lowest first, issues as evidence, gated by availability', () => {
    const report = aio([aioPage('https://s.test/x', 50), aioPage('https://s.test/y', 20, ['dangling-pronoun']), aioPage('https://s.test/ok', 95, []), aioPage('https://s.test/w', 20)]);
    const actions = aioActions(scope, report);
    expect(actions.map((item) => item.urls[0])).toEqual(['https://s.test/w', 'https://s.test/y', 'https://s.test/x']);
    expect(actions[1].evidence[0].items).toEqual(['dangling-pronoun', 'no-entity']);
    expect(actions[0].drillTab).toBe('aio');
    for (const availability of ['unavailable', 'error', 'cancelled']) expect(aioActions(scope, aio([aioPage('u', 1)], availability))).toEqual([]);
    expect(aioActions(scope, null)).toEqual([]);
  });

  it('feeds buildActionFeed without a default URL map and keeps Execution Cards module-only', () => {
    const hss = computeHss([{ module: 'sfs', value: 70 }], 'r');
    const feed = buildActionFeed({ ...scope, hss, aio: aio([aioPage('https://s.test/w', 20)]), sprs: sprs([page('a', 1, { leak: true })]) });
    expect(feed.map((item) => item.source)).toEqual(['aior']);
    const withMap = buildActionFeed({ ...scope, hss, sprs: sprs([page('a', 1, { leak: true })]), urlByNode: urls });
    expect(withMap[0].type).toBe('sprs:fix-leak');
    for (const action of [...feed, ...withMap]) {
      const card = buildExecutionCard(action, hss);
      expect(card.artifact.kind).toBe('module');
      expect(card.deployment).toMatchObject({ task: null, brief: null, noTask: 'in-module' });
    }
  });
});

describe('feed titles for SPRS and AIO-R actions', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); localStorage.clear(); });

  it('renders readable titles', () => {
    const hss = computeHss([{ module: 'sfs', value: 70 }], 'r');
    const actions: ExecutiveAction[] = [...sprsActions(scope, sprs([page('a', 1, { leak: true }), page('b', 2, { underLinked: true })]), urls), ...aioActions(scope, aio([aioPage('https://s.test/w', 20)]))];
    render(<ExecutiveActionFeed actions={actions} hss={hss} onOpen={vi.fn()} />);
    expect(screen.getByText('Fix link leak on https://s.test/a')).toBeTruthy();
    expect(screen.getByText('Add inbound links to https://s.test/b')).toBeTruthy();
    expect(screen.getByText('Rewrite weak passages on https://s.test/w')).toBeTruthy();
  });
});
