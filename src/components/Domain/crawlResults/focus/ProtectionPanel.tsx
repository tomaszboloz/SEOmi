import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SiteFocusReport } from '@/services/siteFocus';
import { decideProtection, DEFAULT_TRS_THRESHOLD } from '@/services/urlProtection';
import { ensureUrlTelemetry, type UrlTelemetry } from '@/services/urlTelemetry';
import { TelemetrySources } from './TelemetrySources';

const MAX_ROWS = 20;
const NONE = { state: 'unavailable', value: null } as const;

const keyOf = (url: string): string => url.replace(/\/+$/, '');

/** Advisory PRI guardrail for low-TRS pages. No snapshot means an empty state, never zeros. */
export const ProtectionPanel = ({ report, projectId }: { report: SiteFocusReport; projectId?: string | null }) => {
  const { t } = useTranslation();
  const low = report.pages.filter((page) => !page.skipped && page.trs < DEFAULT_TRS_THRESHOLD);
  const snapshot = projectId ? ensureUrlTelemetry(projectId, report.pages.map((page) => page.url)) : null;
  if (!low.length) return null;
  const byUrl = new Map((snapshot?.urls ?? []).map((row) => [keyOf(row.url), row]));
  const rows = low.slice(0, MAX_ROWS).map((page) => {
    const found = byUrl.get(keyOf(page.url));
    const telemetry: UrlTelemetry = found ?? { url: page.url, gsc: NONE, ga4: NONE, backlinks: NONE, revenue: NONE };
    return { page, result: decideProtection(page.trs, telemetry) };
  });
  return (
    <section className="space-y-2 rounded-lg border border-white/10 p-3 text-xs" data-testid="protection-panel">
      <h3 className="flex items-center gap-2 font-semibold">{t('focus.protection.title')}<HelpTip id="focus.protection" /></h3>
      <TelemetrySources snapshot={snapshot} />
      {!snapshot && <p role="status" data-testid="protection-empty">{t('focus.protection.empty')}</p>}
      <ul className="space-y-1">
        {rows.map(({ page, result }) => (
          <li key={page.url}>
            <span className="font-mono">{page.url}</span>
            {' '}
            <strong>{t(`focus.protection.decision.${result.decision}`)}</strong>
            {' '}
            <span>{t(`focus.protection.reason.${result.reasons[0]}`)}</span>
            {result.pri.pri !== null && <span>{' '}{t('focus.protection.pri', { value: result.pri.pri.toFixed(2) })}</span>}
          </li>
        ))}
      </ul>
      <p>{t('focus.protection.advisory')}</p>
    </section>
  );
};
