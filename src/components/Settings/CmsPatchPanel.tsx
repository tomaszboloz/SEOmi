import { useTranslation } from 'react-i18next';
import { useProjectStore } from '@/stores/projectStore';
import { CmsTargetFields } from './cms/CmsTargetFields';
import { CmsChangeFields } from './cms/CmsChangeFields';
import { CmsDiffPreview } from './cms/CmsDiffPreview';
import { CmsPatchActions } from './cms/CmsPatchActions';
import { useCmsPatchPanel } from './cms/useCmsPatchPanel';

const ProjectCmsPanel = ({ projectId }: { projectId: string | null }) => {
  const { t } = useTranslation();
  const controller = useCmsPatchPanel(projectId);
  const { plan, changed, busy, status, error } = controller;
  return <section aria-label={t('cmsPanelUi.title')} aria-busy={busy}
    className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
    <h3 className="font-semibold text-slate-200">{t('cmsPanelUi.title')}</h3>
    <p>{t('cmsPanelUi.description')}</p>
    <p>{t('cmsPanelUi.credentialHelp')}</p>
    {!projectId && <p>{t('cmsPanelUi.noProject')}</p>}
    <fieldset disabled={busy || !projectId} className="space-y-3">
      <CmsTargetFields {...controller} />
      <CmsChangeFields {...controller} />
      {plan && <CmsDiffPreview plan={plan} changed={changed} />}
      <CmsPatchActions {...controller} />
    </fieldset>
    {busy && <p role="status">{t('cmsPanelUi.busy')}</p>}
    {status && <p role="status" aria-live="polite">{t(`cmsUi.${status === 'dry-run' ? 'dryRun' : status}`)}</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
};

export const CmsPatchPanel = () => {
  const projectId = useProjectStore((state) => state.activeProjectId);
  return <ProjectCmsPanel key={projectId} projectId={projectId} />;
};
