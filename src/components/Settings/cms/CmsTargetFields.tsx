import { useTranslation } from 'react-i18next';
import type { CmsKind } from '@/services/cmsPatch/types';
import type { CmsPanelController } from './useCmsPatchPanel';

const inputClass = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white';
export const CmsTargetFields = ({ fields, update }: CmsPanelController) => {
  const { t } = useTranslation();
  return <div className="grid gap-3 sm:grid-cols-2">
    <label>{t('cmsPanelUi.kind')}<select className={inputClass} value={fields.kind}
      onChange={(event) => update('kind', event.target.value as CmsKind)}>
      {(['wordpress', 'strapi', 'webhook'] as const).map((kind) => <option key={kind} value={kind}>{t(`cmsUi.kind.${kind}`)}</option>)}
    </select></label>
    <label>{t('cmsPanelUi.baseUrl')}<input className={inputClass} type="url" value={fields.baseUrl}
      onChange={(event) => update('baseUrl', event.target.value)} /></label>
    <label>{t('cmsPanelUi.contentId')}<input className={inputClass} value={fields.contentId}
      onChange={(event) => update('contentId', event.target.value)} /></label>
    <label>{t('cmsPanelUi.credential')}<input className={inputClass} value={fields.credential} autoComplete="off"
      onChange={(event) => update('credential', event.target.value)} /></label>
    {fields.kind === 'strapi' && <label>{t('cmsPanelUi.collection')}<input className={inputClass} value={fields.collection}
      onChange={(event) => update('collection', event.target.value)} /></label>}
  </div>;
};
