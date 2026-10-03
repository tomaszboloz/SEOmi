import React from 'react';
import type { ScheduledAudit } from '@/services/auditSchedule';
import { ScheduledAuditItem } from './ScheduledAuditItem';

interface ScheduledAuditsListProps {
  schedules: ScheduledAudit[];
  language: string;
  onRunNow: (id: string) => void;
  onToggleEnabled: (id: string, currentEnabled: boolean) => void;
  onRemove: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export const ScheduledAuditsList: React.FC<ScheduledAuditsListProps> = ({
  schedules,
  language,
  onRunNow,
  onToggleEnabled,
  onRemove,
  t,
}) => {
  if (schedules.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
        {t('schedules.empty')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
      {schedules.map((schedule) => (
        <ScheduledAuditItem
          key={schedule.id}
          schedule={schedule}
          language={language}
          onRunNow={onRunNow}
          onToggleEnabled={onToggleEnabled}
          onRemove={onRemove}
          t={t}
        />
      ))}
    </ul>
  );
};
