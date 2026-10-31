import { readJsonStorage, writeJsonStorage } from '@/services/storage';
import { actionId } from './identity';
import type { ExecutiveAction } from './types';

/** Review decision on one action (#89 GEM-89-08). It records intent only: nothing is changed on the site. */
export type ActionDecisionKind = 'accepted' | 'deferred' | 'rejected';
export const ACTION_DECISIONS: readonly ActionDecisionKind[] = ['accepted', 'deferred', 'rejected'];
export const DECISION_HISTORY_LIMIT = 500;

export interface ActionDecision {
  /** Run-independent subject (type + canonical URLs), so a decision follows the action into the next crawl. */
  subject: string;
  actionId: string;
  runId: string;
  decision: ActionDecisionKind;
  at: string;
}

const keyFor = (projectId: string): string => `seomi_project_${projectId}_action_decisions_v1`;

/** Same identity rule as `actionId`, without the run, so repeated crawls map to one subject. */
export const actionSubject = (projectId: string, action: Pick<ExecutiveAction, 'type' | 'urls'>): string =>
  actionId(projectId, '', action.type, action.urls, action.type === 'internal-link');

const isDecision = (value: unknown): value is ActionDecision => {
  const row = value as Partial<ActionDecision> | null;
  return Boolean(row) && typeof row === 'object' && typeof row!.subject === 'string' && typeof row!.actionId === 'string'
    && typeof row!.runId === 'string' && typeof row!.at === 'string' && ACTION_DECISIONS.includes(row!.decision as ActionDecisionKind);
};

/** Append-only decision log of a project, oldest first; damaged rows are dropped. */
export const readDecisionLog = (projectId: string | null | undefined): ActionDecision[] => {
  if (!projectId) return [];
  const raw = readJsonStorage(keyFor(projectId), []);
  return Array.isArray(raw) ? raw.filter(isDecision).slice(-DECISION_HISTORY_LIMIT) : [];
};

/** Latest decision per subject. */
export const currentDecisions = (log: readonly ActionDecision[]): Map<string, ActionDecision> =>
  new Map(log.map((row) => [row.subject, row]));

/** Appends a decision; the history keeps earlier ones so a review can be audited. Returns the new log. */
export const recordDecision = (
  projectId: string | null | undefined, runId: string, action: Pick<ExecutiveAction, 'id' | 'type' | 'urls'>,
  decision: ActionDecisionKind, at = new Date().toISOString(),
): ActionDecision[] => {
  if (!projectId) return [];
  const row: ActionDecision = { subject: actionSubject(projectId, action), actionId: action.id, runId, decision, at };
  const log = [...readDecisionLog(projectId), row].slice(-DECISION_HISTORY_LIMIT);
  return writeJsonStorage(keyFor(projectId), log) ? log : readDecisionLog(projectId);
};

/** Decision history of one action across runs, newest first. */
export const decisionHistory = (log: readonly ActionDecision[], subject: string): ActionDecision[] =>
  log.filter((row) => row.subject === subject).reverse();
