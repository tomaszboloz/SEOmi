import { describe, expect, it } from 'vitest';
import { decisionProblems, PROFILE_DECISIONS, type ProfileDecision } from '@/services/scoreProfiles/decisions';
import { SFS_TRS_SCALE } from '@/services/siteFocus';
import { DEFAULT_TRS_THRESHOLD } from '@/services/urlProtection/decide';

describe('score profile decision register (#83 GEM-83-02..15)', () => {
  it('lists every divergence named in #83 once', () => {
    const ids = PROFILE_DECISIONS.map((decision) => decision.id);
    expect(ids).toEqual(['D-SFS', 'D-PRI', 'D-LOG', 'D-DRAFT', 'D-TAS', 'D-AIO', 'D-IGOS', 'D-EETV', 'D-SIJA', 'D-SPRS', 'D-HSS', 'D-ANCHOR']);
    expect(PROFILE_DECISIONS.flatMap(decisionProblems)).toEqual([]);
  });

  it('reads the code side from the shipped constants', () => {
    const find = (id: string) => PROFILE_DECISIONS.find((decision) => decision.id === id)!.code;
    expect(find('D-SFS')).toMatchObject({ trsScale: SFS_TRS_SCALE, excellent: 90, weak: 40 });
    expect(find('D-PRI')).toMatchObject({ trsThreshold: DEFAULT_TRS_THRESHOLD, priThreshold: 0.15, clicks: 50, conversions: 1, domains: 5 });
    expect(find('D-LOG')).toMatchObject({ windowDays: 30, starvationMaxHits: 2, wasteMaxTrs: 45, wasteMinHits: 25 });
    expect(find('D-DRAFT')).toEqual({ prePublishCosine: 0.85, sameIntentCosine: 0.88 });
  });

  it('accepts a decision only with author, valid date and chosen variant', () => {
    const base = PROFILE_DECISIONS[0];
    const accepted: ProfileDecision = { ...base, status: 'accepted', author: 'Jane', decidedAt: '2026-11-02', chosen: 'code' };
    expect(decisionProblems(accepted)).toEqual([]);
    expect(decisionProblems({ ...accepted, author: ' ', decidedAt: 'soon', chosen: undefined }))
      .toEqual(['accepted-without-author', 'accepted-without-date', 'accepted-without-choice']);
    expect(decisionProblems({ ...base, status: 'proposed', author: 'agent' })).toEqual(['proposed-with-author']);
  });

  it('records every entry as accepted by owner delegation on a fixed date', () => {
    expect(PROFILE_DECISIONS.every((decision) => decision.status === 'accepted' && decision.chosen === 'code')).toBe(true);
    expect(PROFILE_DECISIONS.every((decision) => decision.decidedAt === '2026-11-01')).toBe(true);
    expect(PROFILE_DECISIONS.every((decision) => decision.rationale?.startsWith('accepted by owner delegation 2026-11-01'))).toBe(true);
  });
});
