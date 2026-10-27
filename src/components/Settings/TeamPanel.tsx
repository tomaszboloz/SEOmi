import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { ROLES, type Role } from '@/services/team/roles';
import { TeamAuditTable } from './team/TeamAuditTable';
import { TeamPermissionMatrix } from './team/TeamPermissionMatrix';
import { useTeamPanel } from './team/useTeamPanel';

/** Local team mode: acting identity, role/permission matrix and the tamper-evident audit trail (issue #141). */
export const TeamPanel: React.FC = () => {
  const { t } = useTranslation();
  const { identity, log, verdict, error, update, exportCsv } = useTeamPanel();
  const [actor, setActor] = React.useState(identity.actor);
  const commitActor = () => { const next = actor.trim().slice(0, 80); if (next && next !== identity.actor) void update({ ...identity, actor: next }); else setActor(identity.actor); };

  return (
    <section aria-label={t('teamPanelUi.title')} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-slate-200"><Users className="h-4 w-4 text-emerald-400" />{t('teamPanelUi.title')}</h3>
      <p className="text-[11px] leading-5 text-slate-400">{t('teamPanelUi.description')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-slate-400">{t('teamPanelUi.actor')}
          <input value={actor} maxLength={80} onChange={(event) => setActor(event.target.value)} onBlur={commitActor} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white" />
        </label>
        <label className="text-[11px] text-slate-400">{t('teamPanelUi.role')}
          <select value={identity.role} onChange={(event) => { void update({ ...identity, role: event.target.value as Role }); }} className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white">
            {ROLES.map((role) => <option key={role} value={role}>{t(`teamPanelUi.roles.${role}`)}</option>)}
          </select>
        </label>
      </div>
      <TeamPermissionMatrix />
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold text-slate-300">{t('teamPanelUi.auditTitle')}</h4>
        <button type="button" disabled={!log.length} onClick={exportCsv} className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 disabled:opacity-40">{t('teamPanelUi.exportCsv')}</button>
      </div>
      <p aria-live="polite" className={`text-[11px] ${verdict.ok ? 'text-emerald-300' : 'text-red-300'}`}>
        {verdict.ok ? t('teamPanelUi.chainOk') : t('teamPanelUi.chainBroken', { entry: verdict.brokenAt + 1, reason: verdict.reason })}
      </p>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
      <TeamAuditTable log={log} />
    </section>
  );
};
