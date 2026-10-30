import { useTranslation } from 'react-i18next';
import { AddTaskButton } from '@/components/Charts/OptimizationTaskTracker';
import { ACTION_DECISIONS, actionSubject, decisionHistory, type ActionDecision, type ActionDecisionKind, type ExecutiveAction } from '@/services/actionFeed';
import type { HssReport } from '@/services/hss';
import type { TaskModule } from '@/services/optimizationTasks/types';

const btn = 'rounded border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
const TRACKED: readonly string[] = ['sfs', 'tas', 'sprs', 'eetv'];

/** Tracker module for an internal-link action: the module whose simulation declared the gain, else SPRS (link flow). */
const taskModule = (action: ExecutiveAction): TaskModule =>
  (action.moduleDelta && TRACKED.includes(action.moduleDelta.module) ? action.moduleDelta.module : 'sprs') as TaskModule;

export interface ExecutiveActionReviewProps {
  projectId: string;
  action: ExecutiveAction;
  hss: HssReport;
  log: readonly ActionDecision[];
  onDecide: (action: ExecutiveAction, decision: ActionDecisionKind) => void;
}

/**
 * Review step of the action feed (#89 GEM-89-08): accept / defer / reject with a dated history that follows
 * the action across crawls, and hand-off of link actions to the existing task tracker. Nothing is deployed.
 */
export const ExecutiveActionReview = ({ projectId, action, hss, log, onDecide }: ExecutiveActionReviewProps) => {
  const { t, i18n } = useTranslation();
  const history = decisionHistory(log, actionSubject(projectId, action));
  const current = history[0];
  const module = taskModule(action);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div role="group" aria-label={t('executive.review.group')} className="flex flex-wrap gap-1">
        {ACTION_DECISIONS.map((decision) => (
          <button key={decision} type="button" aria-pressed={current?.decision === decision} onClick={() => onDecide(action, decision)}
            className={`${btn} ${current?.decision === decision ? 'border-emerald-400 text-emerald-200' : 'border-slate-700 text-slate-200'}`}>
            {t(`executive.review.decision.${decision}`)}
          </button>
        ))}
      </div>
      {current && <span className="text-slate-400">{t('executive.review.current', { decision: t(`executive.review.decision.${current.decision}`), date: new Date(current.at).toLocaleDateString(i18n.language), count: history.length })}</span>}
      {action.type === 'internal-link' && action.urls.length === 2 && (
        <AddTaskButton projectId={projectId} task={{ kind: 'add-link', module, url: action.urls[0], targetUrl: action.urls[1], baselineScore: hss.components.find((item) => item.module === module)?.value ?? null }} />
      )}
    </div>
  );
};
