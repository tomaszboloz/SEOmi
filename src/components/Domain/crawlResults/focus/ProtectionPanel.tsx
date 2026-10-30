import { useReducer } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SiteFocusReport } from '@/services/siteFocus';
import { DEFAULT_PRI_THRESHOLD, DEFAULT_TRS_THRESHOLD, protectionRows } from '@/services/urlProtection';
import { ProtectionRow } from './ProtectionRow';
import { TelemetrySources } from './TelemetrySources';
import { RevenueImport } from './RevenueImport';

/** Advisory PRI guardrail for low-TRS pages. No snapshot means an empty state, never zeros. */
export const ProtectionPanel = ({ report, projectId }: { report: SiteFocusReport; projectId?: string | null }) => {
  const { t } = useTranslation();
  // Re-read telemetry after a revenue import; the import drops the cached snapshot.
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const { snapshot, rows } = protectionRows(report, projectId);
  if (!rows.length) return null;
  return (
    <section className="space-y-2 rounded-lg border border-white/10 p-3 text-xs" data-testid="protection-panel">
      <h3 className="flex items-center gap-2 font-semibold">{t('focus.protection.title')}<HelpTip id="focus.protection" /></h3>
      <TelemetrySources snapshot={snapshot} />
      {projectId && <RevenueImport key={projectId} projectId={projectId} onChange={refresh} />}
      {!snapshot && <p role="status" data-testid="protection-empty">{t('focus.protection.empty')}</p>}
      <ul className="space-y-1">
        {rows.map(({ url, result }) => <ProtectionRow key={url} url={url} result={result} />)}
      </ul>
      <p data-testid="protection-rule">{t('focus.protection.rule', { trs: DEFAULT_TRS_THRESHOLD, pri: DEFAULT_PRI_THRESHOLD })}</p>
      <p>{t('focus.protection.advisory')}</p>
    </section>
  );
};
