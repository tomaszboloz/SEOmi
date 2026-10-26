import { useTranslation } from 'react-i18next';
import type { CmsPanelController } from './useCmsPatchPanel';

const inputClass = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white';
export const CmsChangeFields = ({ fields, update }: CmsPanelController) => {
  const { t } = useTranslation();
  return <div className="space-y-3">
    <label className="block">{t('cmsPanelUi.heading')}<input className={inputClass} value={fields.heading}
      onChange={(event) => update('heading', event.target.value)} /></label>
    <label className="block">{t('cmsPanelUi.replacement')}<textarea className={inputClass} rows={4} value={fields.replacement}
      onChange={(event) => update('replacement', event.target.value)} /></label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={fields.ymyl}
      onChange={(event) => update('ymyl', event.target.checked)} />{t('cmsPanelUi.ymyl')}</label>
  </div>;
};
