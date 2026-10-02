import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetadataTableProps } from './metadataTypes';
import { ShowOnPageButton } from '@/components/Results/ShowOnPageButton';

export const MetadataAccessibilityHidden: React.FC<MetadataTableProps> = ({ audit }) => {
  const { t } = useTranslation();

  return (
    <>
      {(audit.accessibility?.hidden_form_control_count ?? 0) > 0 && (
        <section className="border-t border-slate-800 px-4 py-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{t('accessibility.hiddenTitle', { count: audit.accessibility?.hidden_form_control_count ?? 0 })}</h5>
          <p className="mt-1 text-[10px] text-slate-500">{t('accessibility.hiddenDescription')}</p>
          <div className="mt-2 space-y-2">
            {(audit.accessibility?.hidden_form_controls ?? []).map((element) => (
              <div key={`${element.dom_position}-${element.dom_query}`} className="rounded border border-slate-800 bg-slate-950/50 p-2">
                <p className="text-[10px] text-slate-400">{t('accessibility.hiddenControlPosition', { position: element.dom_position })}{element.line ? t('accessibility.source', { line: element.line, column: element.column ?? 1 }) : t('accessibility.sourceUnavailable')}</p>
                <code className="mt-1 block break-all text-[10px] text-emerald-200">{element.dom_query}</code>
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-slate-300">{element.html_snippet}</pre>
                <ShowOnPageButton url={audit.final_url || audit.url} selector="input, select, textarea" domIndex={element.dom_position - 1} label={`${t('accessibility.hiddenControl')} #${element.dom_position}`} />
              </div>
            ))}
            {(audit.accessibility?.hidden_form_controls?.length ?? 0) < (audit.accessibility?.hidden_form_control_count ?? 0) && <p className="text-[10px] text-amber-300">{t('accessibility.limitFirst', { shown: audit.accessibility?.hidden_form_controls?.length ?? 0 })}</p>}
          </div>
        </section>
      )}
      {(audit.accessibility?.anti_spam_text_control_count ?? 0) > 0 && (
        <section className="border-t border-slate-800 px-4 py-3">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{t('accessibility.antispamTitle', { count: audit.accessibility?.anti_spam_text_control_count })}</h5>
          <p className="mt-1 text-[10px] text-slate-500">{t('accessibility.antispamDescription')}</p>
          <div className="mt-2 space-y-2">
            {(audit.accessibility?.anti_spam_text_controls ?? []).map((element) => (
              <div key={`${element.dom_position}-${element.dom_query}`} className="rounded border border-slate-800 bg-slate-950/50 p-2">
                <p className="text-[10px] text-slate-400">{t('accessibility.textFieldPosition', { position: element.dom_position })}</p>
                <code className="mt-1 block break-all text-[10px] text-emerald-200">{element.dom_query}</code>
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] text-slate-300">{element.html_snippet}</pre>
                <ShowOnPageButton url={audit.final_url || audit.url} selector="input, select, textarea" domIndex={element.dom_position - 1} label={t('accessibility.antispamLabel', { position: element.dom_position })} />
              </div>
            ))}
            {(audit.accessibility?.anti_spam_text_controls?.length ?? 0) < (audit.accessibility?.anti_spam_text_control_count ?? 0) && <p className="text-[10px] text-amber-300">{t('accessibility.limitFirst', { shown: audit.accessibility?.anti_spam_text_controls?.length ?? 0 })}</p>}
          </div>
        </section>
      )}
    </>
  );
};
