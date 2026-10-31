import { useTranslation } from 'react-i18next';
import { ACTION_DECISIONS, actionSubject, decisionHistory, type ActionDecision, type ActionDecisionKind, type ExecutiveAction } from '@/services/actionFeed';

const btn = 'rounded border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';

export interface ExecutiveActionReviewProps {
  projectId: string;
  action: ExecutiveAction;
  log: readonly ActionDecision[];
  onDecide: (action: ExecutiveAction, decision: ActionDecisionKind) => void;
}

/**
 * Review step of the action feed (#89 GEM-89-08): accept / defer / reject with a dated history that follows
 * the action across crawls. The tracker hand-off lives in the Execution Card (#124). Nothing is deployed.
 */
export const ExecutiveActionReview = ({ projectId, action, log, onDecide }: ExecutiveActionReviewProps) => {
  const { t, i18n } = useTranslation();
  const history = decisionHistory(log, actionSubject(projectId, action));
  const current = history[0];
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
    </div>
  );
};
