import { useTranslation } from 'react-i18next';
import type { EntityRole, TrustGraphEntity, TrustGraphRole, TrustReport } from '@/services/eeatTrust';
import { FOCUS_RING } from './trustHelpers';

export interface TrustGraphPanelProps {
  report: TrustReport;
  onVerifyEntity?: (entity: TrustGraphEntity, role: EntityRole) => void;
}

const roles = (items: TrustGraphRole[]): EntityRole[] => items.filter((role): role is EntityRole => role !== 'document');

export const TrustGraphPanel = ({ report, onVerifyEntity }: TrustGraphPanelProps) => {
  const { t } = useTranslation();
  const graph = report.graph;
  if (!graph) return null;
  return (
    <section aria-labelledby="trust-graph-title" className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h2 id="trust-graph-title" className="text-sm font-semibold text-slate-200">
          {t('trust.graph.title', { defaultValue: 'Entity trust graph' })}
        </h2>
        <p className="text-xs text-slate-400">
          {t('trust.graph.summary', { defaultValue: '{{entities}} entities · {{edges}} role edges · {{diagnostics}} diagnostics', entities: graph.entities.length, edges: graph.edges.length, diagnostics: graph.diagnostics.length })}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {graph.entities.slice(0, 40).map((entity) => {
          const entityRoles = roles(entity.roles);
          return (
            <article key={entity.key} className="rounded border border-slate-800 p-2 text-xs text-slate-300">
              <div className="font-medium text-slate-200" title={entity.names.join(' · ')}>{entity.id ?? entity.key}</div>
              <div className="mt-1 text-slate-400">{entityRoles.map((role) => t(`trust.graph.roles.${role}`, { defaultValue: role })).join(' · ') || t('trust.graph.roles.document', { defaultValue: 'document' })} · {entity.complete ? t('trust.graph.definition', { defaultValue: 'definition' }) : t('trust.graph.referenceOnly', { defaultValue: 'reference only' })}</div>
              <div className="mt-1 break-all text-slate-500">{entity.declarations.slice(0, 3).map((item) => `${item.sourcePage} · ${item.declaration}:${item.nodePath}`).join(' | ')}</div>
              {entityRoles.map((role) => {
                const reconciliation = entity.reconciliations?.[role];
                const verified = reconciliation?.profiles.filter((profile) => profile.status === 'verified') ?? [];
                return <div key={role} className="mt-1 text-slate-400">{t('trust.graph.status', { defaultValue: '{{role}} status: {{status}}', role: t(`trust.graph.roles.${role}`, { defaultValue: role }), status: reconciliation?.status ?? 'unavailable' })}{verified[0] ? ` · ${t('trust.graph.verifiedProfile', { defaultValue: 'verified profile: {{url}}', url: verified[0].url })}` : ` · ${t('trust.graph.noVerifiedProfile', { defaultValue: 'no verified profile; this does not verify qualifications' })}`}{onVerifyEntity && <button type="button" onClick={() => onVerifyEntity(entity, role)} className={`ms-1 rounded border border-slate-600 px-2 py-0.5 text-sky-300 hover:bg-slate-800 ${FOCUS_RING}`}>{t('trust.graph.verifyRole', { defaultValue: 'Verify {{role}}', role: t(`trust.graph.roles.${role}`, { defaultValue: role }) })}</button>}</div>;
              })}
            </article>
          );
        })}
      </div>
      {graph.diagnostics.length > 0 && (
        <div className="border-t border-slate-800 pt-2 text-xs">
          <h3 className="font-medium text-amber-200">{t('trust.graph.diagnostics', { defaultValue: 'Diagnostics' })}</h3>
          <ul className="mt-1 space-y-1 text-slate-400">
            {graph.diagnostics.slice(0, 30).map((item, index) => <li key={`${item.code}|${item.sourcePage ?? ''}|${index}`}>{item.severity}: {item.code}{item.sourcePage ? ` · ${item.sourcePage}` : ''}{item.nodePath ? ` · ${item.nodePath}` : ''}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
};
