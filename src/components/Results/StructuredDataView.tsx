import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileJson, Copy, Check, Code2 } from 'lucide-react';
import { PageAuditData } from '@/types';
import { useAuditStore } from '@/stores/auditStore';
import { getStructuredDataProblems } from '@/services/auditProblems';
import { ProblemsOnlyNotice } from './ProblemsOnlyNotice';
import { copyText } from '@/services/clipboard';
import { localizeStructuredDataFinding } from '@/services/schemaIssueLocalization';
import { useTransientValue } from '@/hooks/useTransientValue';

interface StructuredDataViewProps {
  audit: PageAuditData;
}

export const StructuredDataView: React.FC<StructuredDataViewProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [copiedIdx, setCopiedIdx] = useTransientValue<number | null>(null, 1500);
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);

  const { structured_data } = audit;
  const structuredDataProblems = getStructuredDataProblems(audit);

  const handleCopy = async (content: Record<string, unknown>, idx: number) => {
    const copied = await copyText(JSON.stringify(content, null, 2));
    if (!copied) return;
    setCopiedIdx(idx);
  };

  if (showOnlyProblems) {
    return <div className="mx-auto max-w-5xl animate-in fade-in duration-200 p-4 md:p-6"><ProblemsOnlyNotice problems={structuredDataProblems} subject={t('sidebar.structured')} /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileJson className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">{t('sidebar.structured')}</h3>
          <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded-full font-mono">
            {t('legacyUi.structured.found', { count: structured_data.length })}
          </span>
        </div>
      </div>

      {structured_data.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
          <Code2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-white mb-1">
            {t('structured.noStructuredData')}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {t('legacyUi.structured.emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {structured_data.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg"
            >
              {/* Card Header */}
              <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.format}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {item.data_type}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(item.content, idx)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition flex items-center space-x-1.5 border border-slate-700"
                >
                  {copiedIdx === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('legacyUi.structured.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('legacyUi.structured.copy')}</span>
                    </>
                  )}
                </button>
              </div>

              {item.validation_issues && item.validation_issues.length > 0 && <div className="space-y-2 border-b border-slate-800 px-5 py-3" aria-label={t('uiUnits.validationFindings', { format: item.format })}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('legacyUi.structured.validationFindings', { count: item.validation_issues.length })}</p>
                {item.validation_issues.map((finding, findingIdx) => {
                  const localized = localizeStructuredDataFinding(finding, {
                    format: item.format,
                    dataType: item.data_type,
                  }, t);
                  return <div key={`${finding.code}-${findingIdx}`} className={`rounded-md border px-3 py-2 text-xs ${finding.severity === 'error' ? 'border-rose-500/20 bg-rose-500/5 text-rose-200' : finding.severity === 'warning' ? 'border-amber-500/20 bg-amber-500/5 text-amber-200' : 'border-sky-500/20 bg-sky-500/5 text-sky-200'}`}>
                    <p><span className="font-semibold">{localized.displaySeverity} · {finding.code}</span>{finding.path && <span className="ml-2 font-mono text-[10px] opacity-75">{finding.path}</span>}</p>
                    <p className="mt-1 leading-5">{localized.displayMessage}</p>
                    {localized.displayRecommendation && <p className="mt-1 text-[11px] opacity-80">{localized.displayRecommendation}</p>}
                    <details className="mt-2 text-[10px] opacity-80">
                      <summary className="cursor-pointer">{t('schemaFindings.sourceEvidence')}</summary>
                      <p className="mt-1 break-words font-mono">{localized.evidenceMessage}</p>
                      {localized.evidenceRecommendation && <p className="mt-1 break-words">{localized.evidenceRecommendation}</p>}
                    </details>
                  </div>;
                })}
              </div>}

              {/* Formatted JSON output */}
              <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto">
                <pre className="text-emerald-300 leading-relaxed">
                  {JSON.stringify(item.content, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
