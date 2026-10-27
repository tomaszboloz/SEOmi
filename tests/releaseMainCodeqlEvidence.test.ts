import { describe, expect, it } from 'vitest';
import { evaluateMainCodeqlEvidence } from '../scripts/release-codeql-main.mjs';
import { mainAnalyses, mainEvidence, mainHead, mainSha, otherSha } from './releaseMainCodeqlFixtures';

describe('main CodeQL evidence validation', () => {
  it('accepts current main, both real language analyses and zero open alerts', () => {
    expect(evaluateMainCodeqlEvidence(mainEvidence())).toEqual({
      status: 'success', sha: mainSha, analysisIds: [1, 2], openAlerts: 0,
    });
  });

  it.each([{ analyses: [] }, { analyses: mainAnalyses().slice(0, 1) }])('waits for every required language: %j', ({ analyses }) => {
    expect(evaluateMainCodeqlEvidence(mainEvidence({ analyses }))).toMatchObject({ status: 'pending' });
  });

  it.each([{ commit_sha: otherSha }, { ref: 'refs/heads/release/test' }, { tool: { name: 'Other' } }])(
    'does not borrow another SHA, ref or scanner: %j', change => {
      const analyses = mainAnalyses().map(a => ({ ...a, ...change }));
      expect(evaluateMainCodeqlEvidence(mainEvidence({ analyses })).status).toBe('pending');
    },
  );

  it.each([
    { error: 'upload failed' }, { warning: 'partial analysis' }, { error: undefined },
    { rules_count: 0 }, { rules_count: -1 }, { results_count: -1 }, { results_count: 1.5 },
  ])('blocks invalid or incomplete analysis metadata: %j', change => {
    const analyses = mainAnalyses().map(a => ({ ...a, ...change }));
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ analyses }))).toThrow('analysis');
  });

  it.each([undefined, {}, null, ''])('rejects malformed analysis rows: %j', bad => {
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ analyses: [bad] }))).toThrow('metadata');
  });

  it.each([undefined, {}, 'bad'])('rejects malformed analysis lists: %j', analyses => {
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ analyses }))).toThrow('schema');
  });

  it.each([{}, null, 'bad'])('rejects malformed open alert lists: %j', alerts => {
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ alerts }))).toThrow('schema');
  });

  it.each([{ alerts: [{ number: 1, state: 'open' }] }, { alerts: [{ number: 1, state: 'dismissed' }] }, { alerts: [{}] }])(
    'blocks alerts or invalid alert metadata: %j', ({ alerts }) => {
      expect(() => evaluateMainCodeqlEvidence(mainEvidence({ alerts }))).toThrow();
    },
  );

  it.each([mainHead(otherSha), {}, { ...mainHead(), ref: 'refs/heads/other' }, {
    ref: 'refs/heads/main', object: { sha: mainSha, type: 'tag' },
  }])('binds evidence to the current main commit: %j', head => {
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ head }))).toThrow('main ref');
  });

  it('rejects an invalid requested SHA', () => {
    expect(() => evaluateMainCodeqlEvidence({ ...mainEvidence(), sha: 'invalid' })).toThrow('SHA');
  });

  it('does not reuse a previous successful scan after a newer scan reports failure', () => {
    const old = mainAnalyses()[0];
    const newer = { ...old, id: 9, created_at: '2026-10-26T03:21:08Z', error: 'failed' };
    expect(() => evaluateMainCodeqlEvidence(mainEvidence({ analyses: [...mainAnalyses(), newer] }))).toThrow('errors');
  });

  it('prefers creation time over a larger ID from an older analysis', () => {
    const old = { ...mainAnalyses()[0], id: 99, created_at: '2026-10-25T03:20:08Z', error: 'old failure' };
    expect(evaluateMainCodeqlEvidence(mainEvidence({ analyses: [old, ...mainAnalyses()] })).status).toBe('success');
  });
});
