import { useTranslation } from 'react-i18next';
import type { PatchPlan } from '@/services/cmsPatch/plan';

const lineClasses = { add: 'text-emerald-300', del: 'text-red-300', same: 'text-slate-400' };
const markers = { add: '+', del: '-', same: ' ' };
export const CmsDiffPreview = ({ plan, changed }: { plan: PatchPlan; changed: boolean }) => {
  const { t } = useTranslation();
  return <section aria-label={t('cmsPanelUi.diff')} className="space-y-2">
    <h4 className="font-semibold text-slate-200">{t('cmsPanelUi.diff')}</h4>
    <p>{t('cmsPanelUi.revision', { revision: plan.baseRevision })}</p>
    <code className="block break-all text-[10px]">{plan.planHash}</code>
    <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs whitespace-pre-wrap break-all">
      {plan.diff.map((line, index) => <span className={`block ${lineClasses[line.kind]}`} key={index}>{markers[line.kind]} {line.text}</span>)}
    </pre>
    {!changed && <p role="status">{t('cmsPanelUi.noChanges')}</p>}
  </section>;
};
