import { useTranslation } from 'react-i18next';
import type { ProtectionEvidence, ProtectionResult } from '@/services/urlProtection';

const evidenceText = (t: (key: string, params?: Record<string, unknown>) => string, item: ProtectionEvidence): string => {
  const signal = t(`focus.protection.signal.${item.signal}`);
  if (item.value === null) return t('focus.protection.unknown', { signal, state: t(`telemetrySourcesUi.states.${item.state}`) });
  const value = item.signal === 'revenue'
    ? (item.currency ? `${item.value} ${item.currency}` : t('focus.protection.currencyUnknown', { value: item.value }))
    : String(item.value);
  const state = item.state === 'measured' ? '' : ` (${t(`telemetrySourcesUi.states.${item.state}`)})`;
  return `${t('focus.protection.measured', { signal, value })}${state}`;
};

/** One URL: decision, every reason, the raw evidence and the manual alternatives with their conditions. */
export const ProtectionRow = ({ url, result }: { url: string; result: ProtectionResult }) => {
  const { t } = useTranslation();
  return (
    <li className="space-y-1 rounded border border-white/5 p-2" data-testid="protection-row">
      <p>
        <span className="font-mono">{url}</span>
        {' '}
        <strong>{t(`focus.protection.decision.${result.decision}`)}</strong>
        {result.pri.pri !== null && <span>{' '}{t('focus.protection.pri', { value: result.pri.pri.toFixed(2) })}</span>}
      </p>
      <ul className="list-inside list-disc" aria-label={t('focus.protection.reasonsLabel')}>
        {result.reasons.map((reason) => <li key={reason}>{t(`focus.protection.reason.${reason}`)}</li>)}
      </ul>
      <p className="text-slate-400" data-testid="protection-evidence">{result.evidence.map((item) => evidenceText(t, item)).join(' · ')}</p>
      {result.advice.length > 0 && (
        <ul className="space-y-0.5" aria-label={t('focus.protection.alternativesLabel')}>
          {result.advice.map((item) => (
            <li key={item.code} data-testid={`protection-advice-${item.code}`}>
              <span className="font-semibold">{t(`focus.protection.alternative.${item.code}`)}</span>
              {' '}
              {t('focus.protection.onlyIf', { conditions: item.conditions.map((code) => t(`focus.protection.condition.${code}`)).join('; ') })}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
