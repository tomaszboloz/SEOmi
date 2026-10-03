import React from 'react';
import { localizeHtmlValidationFinding } from '@/services/htmlValidationLocalization';
import type { Session } from './validationTabTypes';
import type { CrawledHtmlValidationFinding } from '@/types';

interface ValidationFindingItemProps {
  finding: CrawledHtmlValidationFinding;
  t: Session['t'];
}

export const ValidationFindingItem: React.FC<ValidationFindingItemProps> = ({ finding, t }) => {
  return (
    <li
      className={`rounded-md border p-2 ${
        finding.severity === 'Error'
          ? 'border-rose-500/20 bg-rose-500/5'
          : 'border-amber-500/20 bg-amber-500/5'
      }`}
    >
      <p className="font-medium">
        {finding.severity === 'Error' ? t('componentUi.error') : t('crawl.ui.warning')} · {finding.code}
        {finding.line
          ? ` · ${t('crawlDeepUi.line')} ${finding.line}${finding.column ? `:${finding.column}` : ''}`
          : ''}
      </p>
      <p className="mt-1">{localizeHtmlValidationFinding(finding, t).displayMessage}</p>
      <details className="mt-2 text-[10px] text-slate-500">
        <summary className="cursor-pointer text-slate-400">
          {t('htmlValidationFindings.sourceEvidence')}
        </summary>
        <p className="mt-1 break-words font-mono">{finding.message}</p>
      </details>
      {(finding.element || finding.attribute) && (
        <p className="mt-1 font-mono text-[10px] text-slate-400">
          {finding.element ? `<${finding.element}>` : ''}
          {finding.attribute ? ` [${finding.attribute}]` : ''}
        </p>
      )}
      {finding.value && (
        <code className="mt-1 block max-w-full break-all rounded bg-slate-950/70 p-1 font-mono text-[10px] text-slate-300">
          {finding.value}
        </code>
      )}
      {finding.source_excerpt && (
        <pre className="mt-1 max-w-2xl overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950/70 p-1 font-mono text-[10px] text-slate-400">
          {finding.source_excerpt}
        </pre>
      )}
    </li>
  );
};
