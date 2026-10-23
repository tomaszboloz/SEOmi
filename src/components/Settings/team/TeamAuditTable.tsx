import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditEntry } from '@/services/team/auditLog';

const VISIBLE_ROWS = 20;

/** Newest audit entries first; the full chain stays in storage and in the CSV export. */
export const TeamAuditTable: React.FC<{ log: readonly AuditEntry[] }> = ({ log }) => {
  const { t } = useTranslation();
  if (!log.length) return <p className="text-[11px] text-slate-500">{t('teamPanelUi.auditEmpty')}</p>;
  const rows = log.slice(-VISIBLE_ROWS).reverse();
  return (
    <table className="w-full text-left text-[11px] text-slate-300">
      <thead className="text-slate-500">
        <tr>
          {(['time', 'actor', 'action', 'result'] as const).map((column) => <th key={column} className="py-1 pr-2 font-medium">{t(`teamPanelUi.columns.${column}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <tr key={entry.id} className="border-t border-slate-800">
            <td className="py-1 pr-2 font-mono">{entry.at.replace('T', ' ').slice(0, 19)}</td>
            <td className="py-1 pr-2">{entry.actor} ({t(`teamPanelUi.roles.${entry.role}`)})</td>
            <td className="py-1 pr-2 font-mono">{entry.action}</td>
            <td className="py-1 pr-2">{t(`teamPanelUi.results.${entry.result}`)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
