import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { TemplateEvent } from '@/services/templateGovernor';

export const TemplateGovernorPanel: React.FC<{ events: TemplateEvent[] }> = ({ events }) => {
  const { t } = useTranslation();
  return (
    <section aria-readonly="true" data-proposal-mode="read-only" className="space-y-2 rounded-lg border border-slate-800 p-4 text-sm text-slate-300" data-testid="template-governor-panel">
      <h3 className="flex items-center gap-1 font-semibold text-slate-100">
        {t('templateGovernor.title')}
        <HelpTip id="templateGovernor.informationGain" />
      </h3>
      {events.length === 0 ? (
        <p>{t('templateGovernor.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event, index) => (
            <li key={`${event.pattern}-${index}`} data-testid="template-governor-event" data-pattern={event.pattern} data-pages={event.pageCount} data-information-gain={event.informationGain ?? 'unavailable'} data-unique-variable-share={event.uniqueVariableShare ?? 'unavailable'} data-template-dom-provenance={event.domSignatureProvenance} data-template-variables-provenance={event.injectedVariablesProvenance} data-template-proposal={event.action !== 'none' ? 'read-only' : undefined} data-requires-approval={String(event.recommendation?.requiresApproval ?? true)} data-tas-nodes={event.tasSubtopicCount} data-tas-representatives={event.tasRepresentativeUrls?.length} data-sampled-only={String(Boolean(event.isSampledOnly))} data-verdict={event.verdict}>
              <div className="flex flex-wrap items-center gap-2">
                <p>{event.informationGain !== null ? t('templateGovernor.row', { pattern: event.pattern, count: event.pageCount, gain: Math.round(event.informationGain * 100) }) : t('templateGovernor.rowGainUnavailable', { pattern: event.pattern, count: event.pageCount })}</p>
                {event.domSignatureProvenance === 'unavailable' && <span className="rounded bg-amber-950 px-1.5 py-0.5 text-xs text-amber-300">{t('templateGovernor.unverifiedStructure')}</span>}
                {event.isSampledOnly && <span className="rounded bg-sky-950 px-1.5 py-0.5 text-xs text-sky-300">{t('templateGovernor.sampledOnly')}</span>}
                {event.injectedVariablesProvenance === 'unavailable' && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">{t('templateGovernor.variablesUnavailable')}</span>}
              </div>
              {event.action !== 'none' && <p className="text-amber-300">{t(event.action === 'noindex' ? 'templateGovernor.noindex' : 'templateGovernor.limit')}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
