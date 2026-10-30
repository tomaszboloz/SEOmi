import { describe, expect, it } from 'vitest';
import type { ExecutiveAction } from '@/services/actionFeed';
import { buildExecutionCard } from '@/services/executionCard/fromAction';
import type { HssReport } from '@/services/hss';

const action = (over: Partial<ExecutiveAction>): ExecutiveAction => ({
  id: 'a1', type: 'sfs:add-terms', source: 'sfs', urls: ['https://x.test/a'], evidence: [{ source: 'sfs', code: 'add-terms', items: [' kawa ', 'kawa', 'ziarno'] }],
  effort: null, moduleDelta: { module: 'sfs', value: 3 }, hssDelta: 2.5, conflicts: [], dependsOn: [], blocked: false, drillTab: 'focus', ...over,
});
const hss = { components: [
  { module: 'sfs', status: 'measured', value: 61 },
  { module: 'tas', status: 'unavailable', value: null },
] } as unknown as HssReport;

describe('buildExecutionCard (#124)', () => {
  it('turns a single-page entity action into a task and a brief with deduped items', () => {
    const card = buildExecutionCard(action({}), hss);
    expect(card.diagnosis).toEqual({ codes: ['sfs:add-terms'], hssDelta: 2.5, moduleDelta: 3 });
    expect(card.location.urls).toEqual(['https://x.test/a']);
    expect(card.artifact).toEqual({ kind: 'entities', items: ['kawa', 'ziarno'], drillTab: 'focus' });
    expect(card.deployment.noTask).toBeNull();
    expect(card.deployment.task).toEqual({ kind: 'add-entities', module: 'sfs', url: 'https://x.test/a', requiredEntities: ['kawa', 'ziarno'], baselineScore: 61, priority: 'high', expectedDelta: 3 });
    expect(card.deployment.brief).toEqual({ origin: 'sfs', title: 'https://x.test/a', sourceUrl: 'https://x.test/a', missingEntities: ['kawa', 'ziarno'] });
  });

  it('plans an ordered link task; link source has per-page SPRS so baseline stays unknown', () => {
    const card = buildExecutionCard(action({ type: 'internal-link', source: 'links', urls: ['https://x.test/from', 'https://x.test/to'], moduleDelta: null, hssDelta: null, drillTab: 'visualisations' }), hss);
    expect(card.artifact.kind).toBe('link');
    expect(card.deployment.task).toEqual({ kind: 'add-link', module: 'sprs', url: 'https://x.test/from', targetUrl: 'https://x.test/to', baselineScore: null });
    expect(card.deployment.brief).toBeNull();
  });

  it('never plans removals or blocked actions, and keeps unknown values unset', () => {
    const removal = buildExecutionCard(action({ type: 'sfs:remove-offtopic', urls: ['https://x.test/a', 'https://x.test/b'] }), hss);
    expect(removal.artifact.kind).toBe('removal');
    expect(removal.deployment).toEqual({ task: null, brief: null, noTask: 'removal' });
    const blocked = buildExecutionCard(action({ blocked: true }), hss);
    expect(blocked.deployment).toEqual({ task: null, brief: null, noTask: 'blocked' });
  });

  it('explains missing URLs and module-only fixes', () => {
    expect(buildExecutionCard(action({ type: 'eetv:no-author', source: 'eetv', urls: [], evidence: [{ source: 'eetv', code: 'no-author' }], drillTab: 'trust' })).deployment).toEqual({ task: null, brief: null, noTask: 'no-url' });
    expect(buildExecutionCard(action({ type: 'internal-link', urls: ['https://x.test/a'] })).deployment.noTask).toBe('no-url');
    const many = buildExecutionCard(action({ type: 'sfs:strengthen-borderline', urls: ['https://x.test/a', 'https://x.test/b'], evidence: [{ source: 'sfs', code: 'strengthen-borderline' }] }));
    expect(many.artifact.kind).toBe('module');
    expect(many.deployment.noTask).toBe('in-module');
  });

  it('maps HSS delta to priority and ignores a delta of another module', () => {
    const low = buildExecutionCard(action({ hssDelta: 0, moduleDelta: { module: 'tas', value: 4 } }), hss).deployment.task;
    expect(low?.priority).toBe('low');
    expect(low).not.toHaveProperty('expectedDelta');
    expect(buildExecutionCard(action({ hssDelta: 1 }), hss).deployment.task?.priority).toBe('medium');
    const unknown = buildExecutionCard(action({ hssDelta: null, source: 'tas', type: 'tas:deepen', moduleDelta: null, evidence: [{ source: 'tas', code: 'deepen', items: ['x'] }] }), hss).deployment.task;
    expect(unknown).not.toHaveProperty('priority');
    expect(unknown?.baselineScore).toBeNull();
    expect(buildExecutionCard(action({}), null).deployment.task?.baselineScore).toBeNull();
  });
});
