import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import { copyText } from '@/services/clipboard';
import { MetadataTableProps } from './metadataTypes';
import { ShowOnPageButton } from '@/components/Results/ShowOnPageButton';
import {
  accessibilityFindingMessage,
  accessibilityFindingRecommendation,
  accessibilityFindingEvidence
} from './metadataHelpers';
import { useTransientValue } from '@/hooks/useTransientValue';

export const MetadataAccessibilityFindings: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useTransientValue<string | null>(null, 1500);

  if (!audit.accessibility?.findings || audit.accessibility.findings.length === 0) return null;

  const copyToClipboard = async (text: string, key: string) => {
    const copied = await copyText(text);
    if (!copied) return;
    setCopiedKey(key);
  };

  return (
    <div className="border-t border-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{t('accessibility.findingsTitle')}</h5>
        <span className="text-[10px] text-slate-500">{t('accessibility.findingsMeta', { count: audit.accessibility.findings.length })}</span>
      </div>
      <div className="divide-y divide-slate-800/80">
        {audit.accessibility.findings.map((finding) => {
          const isFormFinding = finding.code === 'accessibility-form-controls-unlabeled' || finding.code === 'accessibility-antispam-control-not-text';
          const isInteractiveFinding = finding.code === 'accessibility-interactive-name-missing';
          const isAriaHiddenFocusableFinding = finding.code === 'accessibility-focusable-aria-hidden';
          const isImageFinding = finding.code === 'accessibility-image-alt-missing';
          const isDuplicateIdFinding = finding.code === 'accessibility-duplicate-id';
          const isAriaReferenceFinding = finding.code === 'accessibility-aria-reference-unresolved';
          const isLanguageFinding = finding.code === 'accessibility-document-language-invalid';
          const isMainLandmarkFinding = finding.code === 'accessibility-multiple-main-landmarks';
          const evidenceSelector = isAriaHiddenFocusableFinding ? "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']" : isInteractiveFinding ? "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']" : isImageFinding ? 'img:not([alt])' : isDuplicateIdFinding ? '[id]' : isAriaReferenceFinding ? '[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]' : isLanguageFinding ? 'html' : isMainLandmarkFinding ? "main, [role='main']" : 'input, select, textarea';
          const evidenceLabel = isAriaHiddenFocusableFinding ? t('accessibility.focusableAriaHidden') : isInteractiveFinding ? t('accessibility.interactiveElement') : isImageFinding ? t('accessibility.image') : isDuplicateIdFinding ? t('accessibility.duplicateId') : isAriaReferenceFinding ? t('accessibility.ariaReference') : isLanguageFinding ? t('accessibility.htmlLanguageElement') : isMainLandmarkFinding ? t('accessibility.mainLandmark') : t('accessibility.formControl');
          const evidencePositionLabel = isFormFinding ? t('accessibility.control') : evidenceLabel;
          const evidencePositionOrder = isFormFinding ? t('accessibility.domOrder') : t('accessibility.selectorOrder');
          return (
            <div key={finding.code} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${finding.severity === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : finding.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-300'}`}>{t(`ampUi.severity.${finding.severity}`)}</span>
                <span className="text-xs font-medium text-slate-100">{accessibilityFindingMessage(finding, audit, t)}</span>
              </div>
              <p className="break-words text-[11px] text-slate-400">{t('accessibility.evidence', { value: accessibilityFindingEvidence(finding, audit, t) })}</p>
              <p className="text-[11px] text-slate-500">{accessibilityFindingRecommendation(finding, t)}</p>
              {(finding.elements?.length ?? 0) > 0 && (
                <details open className="rounded-md border border-slate-700/70 bg-slate-950/50 px-3 py-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-emerald-200">{t('accessibility.elementCount', { count: finding.elements?.length })}</summary>
                  <p className="mt-1 text-[10px] text-slate-500">{t('accessibility.locatorDescription')}</p>
                  {finding.code === 'accessibility-form-controls-unlabeled' && finding.elements!.length < (audit.accessibility?.unlabeled_form_control_count ?? 0) && <p className="mt-1 text-[10px] text-amber-300">{t('accessibility.shownCount', { shown: finding.elements!.length, total: audit.accessibility?.unlabeled_form_control_count ?? 0 })}</p>}
                  {finding.elements!.length === 50 && <p className="mt-1 text-[10px] text-amber-300">{t('accessibility.shownMax')}</p>}
                  <div className="mt-2 space-y-2">
                    {finding.elements?.map((element) => (
                      <div key={`${element.dom_position}-${element.dom_query}`} className="rounded border border-slate-800 bg-slate-900/70 p-2">
                        <p className="text-[10px] text-slate-400">{t('accessibility.elementPosition', { label: evidencePositionLabel, position: element.dom_position, order: evidencePositionOrder, source: element.line ? t('accessibility.source', { line: element.line, column: element.column ?? 1 }) : t('accessibility.sourceUnavailable') })}</p>
                        <code className="mt-1 block break-all text-[10px] text-emerald-200">{element.dom_query}</code>
                        <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-slate-300">{element.html_snippet}</pre>
                        <button type="button" onClick={() => copyToClipboard(`${element.dom_query}\n${element.html_snippet}`, `a11y-${finding.code}-${element.dom_position}`)} aria-label={`${t('accessibility.copyEvidence')} ${evidenceLabel} #${element.dom_position}`} className="mt-1 inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400 transition hover:border-emerald-400/50 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                          {copiedKey === `a11y-${finding.code}-${element.dom_position}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedKey === `a11y-${finding.code}-${element.dom_position}` ? t('accessibility.copiedEvidence') : t('accessibility.copyEvidence')}
                        </button>
                        <ShowOnPageButton url={audit.final_url || audit.url} selector={evidenceSelector} domIndex={element.dom_position - 1} label={`${evidenceLabel} #${element.dom_position}`} />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
