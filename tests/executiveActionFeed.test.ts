import { describe, expect, it } from 'vitest';
import { actionId, buildActionFeed, rankActions, type ExecutiveAction } from '@/services/actionFeed';
import { computeHss } from '@/services/hss';
import type { SiteFocusReport } from '@/services/siteFocus';
import type { TopicalAuthorityReport } from '@/services/topicalAuthority';
import type { TrustReport } from '@/services/eeatTrust';

const effort = { minHours: 2, maxHours: 6, estimate: true as const };
const sfs = {
  score: 60, unavailable: false,
  recommendations: [
    { code: 'remove-offtopic', params: {}, deltaScore: 8, effort, ratio: 2, urls: ['https://a.pl/x/', 'https://a.pl/y'] },
    { code: 'strengthen-borderline', params: {}, deltaScore: 4, effort: { minHours: 1, maxHours: 1, estimate: true }, ratio: 4, urls: ['https://a.pl/y'] },
    { code: 'expand-core-cluster', params: {}, deltaScore: 2, effort, ratio: 0.5, urls: ['https://a.pl/c1'] },
  ],
  linkSuggestions: [{ code: 'link-to-hub', fromUrl: 'https://a.pl/p', toUrl: 'https://a.pl/hub', anchors: ['kawa'] }],
} as unknown as SiteFocusReport;
const tas = { tas: 50, recommendations: [{ code: 'merge-cannibalized', params: {}, deltaTas: 5, effort, ratio: 1, items: [], urls: ['https://a.pl/c1', 'https://a.pl/c2'] }] } as unknown as TopicalAuthorityReport;
const trust = { findings: [{ code: 'no-author', params: {}, severity: 'warning' }, { code: 'fyi', params: {}, severity: 'info' }] } as unknown as TrustReport;
const hss = computeHss([{ module: 'sfs', value: 60 }, { module: 'tas', value: 50 }, { module: 'eetv', value: 70 }, { module: 'aior', value: 80 }], 'run-1');
const opportunity = { id: 'o', sourceUrl: 'https://a.pl/p/', sourceTitle: '', targetUrl: 'https://a.pl/hub', targetTitle: '', sharedTerms: ['kawa', 'ziarno'], weightedJaccard: 0.3 };
const feed = (extra: Partial<Parameters<typeof buildActionFeed>[0]> = {}) => buildActionFeed({ projectId: 'p1', runId: 'run-1', hss, sfs, tas, trust, linkOpportunities: [opportunity], ...extra });
const byType = (actions: ExecutiveAction[], type: string) => actions.find((action) => action.type === type)!;

describe('Executive Action Feed (#89)', () => {
  it('gives stable ids from project/run/type/canonical URLs; link direction matters', () => {
    expect(actionId('p', 'r', 't', ['https://a.pl/b/', 'https://a.pl/a'])).toBe(actionId('p', 'r', 't', ['https://a.pl/a', 'https://a.pl/b']));
    expect(actionId('p', 'r2', 't', ['https://a.pl/a'])).not.toBe(actionId('p', 'r', 't', ['https://a.pl/a']));
    expect(actionId('p', 'r', 'l', ['https://a.pl/a', 'https://a.pl/b'], true)).not.toBe(actionId('p', 'r', 'l', ['https://a.pl/b', 'https://a.pl/a'], true));
  });

  it('merges SFS hub links and lexical opportunities without losing evidence', () => {
    const links = feed().filter((action) => action.type === 'internal-link');
    expect(links).toHaveLength(1);
    expect(links[0].evidence.map((item) => item.source)).toEqual(['sfs', 'links']);
    expect(links[0].hssDelta).toBeNull();
  });

  it('computes HSS delta from the declared module gain on a copy, unavailable otherwise', () => {
    const actions = feed();
    const strengthen = byType(actions, 'sfs:strengthen-borderline');
    const expected = computeHss([{ module: 'sfs', value: 64 }, { module: 'tas', value: 50 }, { module: 'eetv', value: 70 }, { module: 'aior', value: 80 }], 'run-1').value! - hss.value!;
    expect(strengthen.hssDelta).toBeCloseTo(expected, 5);
    expect(byType(actions, 'eetv:no-author').hssDelta).toBeNull();
    expect(actions.some((action) => action.type === 'eetv:fyi')).toBe(false);
    const noHss = feed({ hss: computeHss([], 'run-1') });
    expect(noHss.every((action) => action.hssDelta === null)).toBe(true);
    expect(byType(feed({ tas: { ...tas, tas: null } }), 'tas:merge-cannibalized').moduleDelta).toBeNull();
  });

  it('keep wins over prune and the #81 guardrail blocks removals', () => {
    const remove = byType(feed({ guard: { protectedUrls: ['https://a.pl/x'] } }), 'sfs:remove-offtopic');
    expect(remove.conflicts.map((item) => item.kind).sort()).toEqual(['keep-vs-prune', 'protected-by-evidence']);
    expect(remove.blocked).toBe(true);
    const open = byType(feed(), 'sfs:remove-offtopic');
    expect(open.blocked).toBe(false);
    expect(byType(feed({ guard: { needsDataUrls: ['https://a.pl/x/'] } }), 'sfs:remove-offtopic').conflicts.some((item) => item.kind === 'needs-data')).toBe(true);
  });

  it('expanding a cannibalised URL depends on the merge first', () => {
    const actions = feed();
    const merge = byType(actions, 'tas:merge-cannibalized');
    const expand = byType(actions, 'sfs:expand-core-cluster');
    expect(expand.dependsOn).toEqual([merge.id]);
    expect(expand.conflicts[0]).toMatchObject({ kind: 'merge-vs-expand', urls: ['https://a.pl/c1'] });
  });

  it('ranks deterministically: blocked last, unknown ratios after known ones, id as final key', () => {
    const actions = feed({ guard: { protectedUrls: ['https://a.pl/x'] } });
    expect(actions.at(-1)?.blocked).toBe(true);
    expect(actions[0].type).toBe('sfs:strengthen-borderline');
    expect(rankActions([...actions].reverse()).map((action) => action.id)).toEqual(actions.map((action) => action.id));
    expect(feed({ sfs: { ...sfs, unavailable: true } }).some((action) => action.source === 'sfs')).toBe(false);
  });
});
