import { useTranslation } from 'react-i18next';
import type { CmsPanelController } from './useCmsPatchPanel';

const buttonClass = 'rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 disabled:opacity-40';
export const CmsPatchActions = (controller: CmsPanelController) => {
  const { t } = useTranslation();
  const { busy, ready, prepare, plan, changed, approval, approve, execute, dryRunHash, factGatePassed, confirmFacts } = controller;
  return <div className="space-y-3">
    <button type="button" className={buttonClass} disabled={busy || !ready} onClick={() => void prepare()}>{t('cmsPanelUi.prepare')}</button>
    {plan && changed && <>
      {plan.ymyl && <label className="flex items-center gap-2"><input type="checkbox" checked={factGatePassed}
        disabled={busy} onChange={(event) => confirmFacts(event.target.checked)} />{t('cmsPanelUi.factGate')}</label>}
      <label className="flex items-center gap-2"><input type="checkbox" checked={!!approval}
        disabled={busy} onChange={(event) => approve(event.target.checked)} />{t('cmsPanelUi.approve')}</label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy || !approval}
          onClick={() => void execute(true)}>{t('cmsPanelUi.dryRun')}</button>
        <button type="button" className={buttonClass} disabled={busy || !approval || dryRunHash !== plan.planHash}
          onClick={() => void execute(false)}>{t('cmsPanelUi.apply')}</button>
      </div>
    </>}
  </div>;
};
