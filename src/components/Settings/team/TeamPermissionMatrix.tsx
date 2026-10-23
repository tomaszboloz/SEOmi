import React from 'react';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS, ROLES, can } from '@/services/team/roles';

export const TeamPermissionMatrix: React.FC = () => {
  const { t } = useTranslation();
  return (
    <table className="w-full text-left text-[11px] text-slate-300">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 pr-2 font-medium">{t('teamPanelUi.permissionsTitle')}</th>
          {ROLES.map((role) => <th key={role} className="py-1 pr-2 font-medium">{t(`teamPanelUi.roles.${role}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {PERMISSIONS.map((permission) => (
          <tr key={permission} className="border-t border-slate-800">
            <td className="py-1 pr-2">{t(`teamPanelUi.permissions.${permission}`)}</td>
            {ROLES.map((role) => {
              const allowed = can(role, permission);
              return <td key={role} aria-label={t(allowed ? 'teamPanelUi.allowed' : 'teamPanelUi.notAllowed')} className={allowed ? 'text-emerald-300' : 'text-slate-600'}>{allowed ? '✓' : '–'}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
