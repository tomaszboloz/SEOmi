import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Heading, Copy, Check } from 'lucide-react';
import { PageAuditData } from '@/types';
import { analyzeKeyphrase, flattenHeadings } from '@/services/keyphraseAnalysis';
import { useAuditStore } from '@/stores/auditStore';
import { useProjectStore } from '@/stores/projectStore';
import { ShowOnPageButton } from '@/components/Results/ShowOnPageButton';
import { HeadingsSummaryCards } from './HeadingsSummaryCards';
import { HeadingsViolations } from './HeadingsViolations';
import { useTransientValue } from '@/hooks/useTransientValue';
import { copyText } from '@/services/clipboard';
import { readStorage, writeStorage } from '@/services/storage';

interface HeadingsTreeProps {
  audit: PageAuditData;
}

const keyphraseStorageKey = (projectId: string, target: string): string =>
  `seomi_project_${projectId}_headings_keyphrase_${encodeURIComponent(target)}_v1`;

export const HeadingsTree: React.FC<HeadingsTreeProps> = ({ audit }) => {
  const { t } = useTranslation();
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [copied, setCopied] = useTransientValue(false, 2000);
  const [keyphrase, setKeyphrase] = useState('');
  const showOnlyProblems = useAuditStore((state) => state.showOnlyProblems);
  const auditTarget = audit.final_url || audit.url;
  const savedKeyphraseKey = activeProjectId && auditTarget
    ? keyphraseStorageKey(activeProjectId, auditTarget)
    : null;

  useEffect(() => {
    setKeyphrase(savedKeyphraseKey ? readStorage(savedKeyphraseKey) || '' : '');
  }, [savedKeyphraseKey]);

  const { headings } = audit;
  const flatHeadings = flattenHeadings(headings.hierarchy);
  const keyphraseEvidence = analyzeKeyphrase(audit, keyphrase);

  const handleCopyMarkdownTree = async () => {
    const lines = flatHeadings.map(
      (node) => `${'#'.repeat(node.level)} ${node.text}`
    );
    const copied = await copyText(lines.join('\n'));
    if (!copied) return;
    setCopied(true);
  };


  const getLevelBadgeClass = (level: number) => {
    switch (level) {
      case 1:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 2:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 3:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 4:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-in fade-in duration-200">
      <HeadingsSummaryCards headings={headings} totalHeadings={flatHeadings.length} />

      <HeadingsViolations issues={headings.issues} />

      {!showOnlyProblems && <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <label className="block text-xs font-medium text-slate-300">{t('legacyUi.headings.keyphrase')} <span className="font-normal text-slate-500">{t('legacyUi.headings.keyphraseOptional')}</span>
          <input value={keyphrase} onChange={(event) => { const next = event.target.value; setKeyphrase(next); if (savedKeyphraseKey) writeStorage(savedKeyphraseKey, next); }} placeholder={t('legacyUi.headings.keyphrasePlaceholder')} className="mt-2 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400" />
        </label>
        {keyphrase.trim() && <><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{keyphraseEvidence.map((item) => <div key={item.field} className={`rounded-lg border p-3 ${item.occurrences ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-200">{item.label}</span><span className={item.occurrences ? 'text-emerald-300 text-xs font-semibold' : 'text-amber-300 text-xs font-semibold'}>{item.occurrences}</span></div><p className="mt-1 truncate text-[11px] text-slate-400" title={item.evidence[0]}>{item.evidence[0] || t('legacyUi.headings.noOccurrence')}</p></div>)}</div>{audit.content_stats.body_text_truncated && <p className="mt-2 text-[11px] text-amber-300">{t('legacyUi.headings.truncated')}</p>}</>}
      </section>}

      {/* Interactive Headings Tree Visualizer */}
      {!showOnlyProblems && <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Heading className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">{t('headings.hierarchyTitle')}</h3>
          </div>

          <button
            onClick={handleCopyMarkdownTree}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white font-medium transition flex items-center space-x-1.5 border border-slate-700"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('legacyUi.headings.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('headings.copyTree')}</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 space-y-2">
          {flatHeadings.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              {t('legacyUi.headings.none')}
            </div>
          ) : (
            flatHeadings.map((node, index) => {
              const indentPadding = (node.level - 1) * 24;

              return (
                <div
                  key={index}
                  style={{ paddingLeft: `${indentPadding}px` }}
                  className="flex items-center space-x-3 py-1.5 group"
                >
                  <span
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md border shrink-0 ${getLevelBadgeClass(
                      node.level
                    )}`}
                  >
                    {t("uiUnits.headingLevel", { level: node.level })}
                  </span>
                  <span className="text-xs text-slate-300 font-medium group-hover:text-white transition break-words">
                    {node.text || <span className="text-slate-500 italic">{t('legacyUi.headings.empty')}</span>}
                  </span>
                  <ShowOnPageButton
                    url={audit.final_url || audit.url}
                    selector={`h${node.level}`}
                    needle={node.text || undefined}
                    label={`H${node.level} ${node.text || t('legacyUi.headings.emptyLabel')}`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>}
      {showOnlyProblems && headings.issues.length === 0 && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center text-sm text-emerald-200">{t('legacyUi.headings.noProblems')}</div>}
    </div>
  );
};
