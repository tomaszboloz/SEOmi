import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionId, actionSubject, currentDecisions, decisionHistory, DECISION_HISTORY_LIMIT, readDecisionLog, recordDecision } from '@/services/actionFeed';

const KEY = 'seomi_project_p1_action_decisions_v1';
const link = (runId: string) => ({ id: actionId('p1', runId, 'internal-link', ['https://a.pl/x', 'https://a.pl/y'], true), type: 'internal-link', urls: ['https://a.pl/x', 'https://a.pl/y'] });

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('action review decisions (#89 GEM-89-08)', () => {
  it('follows the same action across runs via a run-independent subject; link direction matters', () => {
    expect(link('r1').id).not.toBe(link('r2').id);
    expect(actionSubject('p1', link('r1'))).toBe(actionSubject('p1', link('r2')));
    expect(actionSubject('p1', link('r1'))).not.toBe(actionSubject('p1', { type: 'internal-link', urls: ['https://a.pl/y', 'https://a.pl/x'] }));
    expect(actionSubject('p1', { type: 'tas:merge', urls: ['b', 'a'] })).toBe(actionSubject('p1', { type: 'tas:merge', urls: ['a', 'b'] }));
  });

  it('appends decisions, keeps history newest first and exposes the latest per subject', () => {
    recordDecision('p1', 'r1', link('r1'), 'deferred', '2026-10-01T00:00:00Z');
    const log = recordDecision('p1', 'r2', link('r2'), 'accepted', '2026-10-02T00:00:00Z');
    const subject = actionSubject('p1', link('r2'));
    expect(decisionHistory(log, subject).map((row) => [row.decision, row.runId])).toEqual([['accepted', 'r2'], ['deferred', 'r1']]);
    expect(currentDecisions(log).get(subject)?.decision).toBe('accepted');
    expect(readDecisionLog('p1')).toHaveLength(2);
  });

  it('needs a project, drops damaged rows and caps the log', () => {
    expect(recordDecision(null, 'r', link('r'), 'accepted')).toEqual([]);
    expect(readDecisionLog(undefined)).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify([{ subject: 's' }, { subject: 's', actionId: 'a', runId: 'r', at: 't', decision: 'maybe' }]));
    expect(readDecisionLog('p1')).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify({ broken: true }));
    expect(readDecisionLog('p1')).toEqual([]);
    const rows = Array.from({ length: DECISION_HISTORY_LIMIT }, (_, index) => ({ subject: `s${index}`, actionId: 'a', runId: 'r', at: 't', decision: 'rejected' }));
    localStorage.setItem(KEY, JSON.stringify(rows));
    const log = recordDecision('p1', 'r', link('r'), 'accepted');
    expect(log).toHaveLength(DECISION_HISTORY_LIMIT);
    expect(log[0].subject).toBe('s1');
  });

  it('returns the stored log unchanged when the write fails', () => {
    recordDecision('p1', 'r1', link('r1'), 'deferred', '2026-10-01T00:00:00Z');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(recordDecision('p1', 'r1', link('r1'), 'accepted').map((row) => row.decision)).toEqual(['deferred']);
  });
});
