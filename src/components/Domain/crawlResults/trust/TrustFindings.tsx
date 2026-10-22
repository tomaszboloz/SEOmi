import { useTranslation } from 'react-i18next';
import type { TrustFinding } from '@/services/eeatTrust';
import { SEVERITY_TEXT } from './trustHelpers';

export const TrustFindings = ({ findings }: { findings: TrustFinding[] }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="trust-findings-title" className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 id="trust-findings-title" className="text-sm font-semibold text-slate-200">{t('trust.findings.title')}</h2>
      {findings.length === 0 ? <p className="text-xs text-emerald-300">{t('trust.findings.none')}</p> : (
        <ol className="list-decimal space-y-1.5 ps-5 text-xs text-slate-300">
          {findings.map((finding) => (
            <li key={`${finding.code}|${JSON.stringify(finding.params)}`}>
              <span className={`me-2 font-semibold uppercase ${SEVERITY_TEXT[finding.severity]}`}>{t(`trust.severity.${finding.severity}`)}</span>
              {t(`trust.findings.code.${finding.code}`, { ...finding.params, defaultValue: finding.code })}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
