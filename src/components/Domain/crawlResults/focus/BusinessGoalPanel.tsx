import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_GOAL_LENGTH, type CoreTopic, type GoalError } from '@/services/siteFocus';
import { can } from '@/services/team/roles';
import { readIdentity } from '@/services/team/identity';
import { deniedMessage, enforcePermission } from '@/services/team/enforce';

export interface BusinessGoalPanelProps {
  coreTopic: CoreTopic;
  /** Saved goal; undefined when none. */
  saved: string | undefined;
  /** False without a project: the goal is a per-project setting and cannot be stored. */
  persisted: boolean;
  onSave: (goal: string) => { ok: true; value: string } | { ok: false; error: GoalError };
}

/** Explicit business goal that steers the Core Topic (#82); explains when it did not decide the topic. */
export const BusinessGoalPanel = ({ coreTopic, saved, persisted, onSave }: BusinessGoalPanelProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(saved ?? '');
  const [error, setError] = useState<GoalError | null>(null);
  const allowed = can(readIdentity().role, 'modify_site_focus_rules');
  const goal = coreTopic.businessGoal;
  const fallback = coreTopic.mode === 'anchored' ? 'anchored' : 'auto';

  const save = () => {
    if (!enforcePermission('modify_site_focus_rules')) return;
    const result = onSave(draft);
    setError(result.ok ? null : result.error);
  };

  return (
    <section aria-labelledby="focus-goal-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="focus-goal-title" className="text-sm font-semibold text-slate-200">{t('focus.goal.title')}</h2>
      <label className="flex flex-col gap-1 text-xs text-slate-300">
        {t('focus.goal.inputLabel')}
        <input
          type="text"
          value={draft}
          maxLength={MAX_GOAL_LENGTH}
          placeholder={t('focus.goal.placeholder')}
          readOnly={!allowed || !persisted}
          aria-invalid={error !== null}
          aria-describedby={error ? 'focus-goal-error' : undefined}
          onChange={(event) => setDraft(event.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!allowed || !persisted}
        className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {t('focus.goal.save')}
      </button>
      <p className="text-xs text-slate-400">{t('focus.goal.help')}</p>
      {error && <p id="focus-goal-error" role="alert" className="text-xs text-rose-300">{t(`focus.goal.error.${error}`, { max: MAX_GOAL_LENGTH })}</p>}
      {!persisted && <p role="note" className="text-xs text-amber-200">{t('focus.goal.needsProject')}</p>}
      <p role="status" className="text-xs text-slate-300" data-testid="focus-goal-status">
        {!goal ? t('focus.goal.none')
          : goal.applied ? t('focus.goal.applied', { input: goal.input })
            : coreTopic.mode === 'manual' ? t('focus.goal.manualWins')
              : t(`focus.goal.unmatched.${fallback}`)}
      </p>
      {!allowed && <p role="note" className="text-xs text-amber-200">{deniedMessage()}</p>}
    </section>
  );
};
