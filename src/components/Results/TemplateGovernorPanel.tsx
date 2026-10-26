import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { TemplateEvent } from '@/services/templateGovernor';

export const TemplateGovernorPanel: React.FC<{ events: TemplateEvent[] }> = ({ events }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="template-governor-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('templateGovernor.title')}
        <HelpTip id="templateGovernor.informationGain" />
      </h3>
      {events.length === 0 ? (
        <p>{t('templateGovernor.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.pattern}>
              <p>{t('templateGovernor.row', { pattern: event.pattern, count: event.pageCount, gain: Math.round(event.informationGain * 100) })}</p>
              {event.action !== 'none' && <p className="text-amber-300">{t(event.action === 'noindex' ? 'templateGovernor.noindex' : 'templateGovernor.limit')}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
