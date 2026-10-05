import React from 'react';
import { useTranslation } from 'react-i18next';
import { Heading, Copy, Check } from 'lucide-react';
import { ShowOnPageButton } from '@/components/Results/ShowOnPageButton';
import { copyText } from '@/services/clipboard';
import type { HeadingNode } from '@/types';
import { useTransientValue } from '@/hooks/useTransientValue';

interface HeadingsTreeViewProps {
  flatHeadings: HeadingNode[];
  auditUrl: string;
}

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

export const HeadingsTreeView: React.FC<HeadingsTreeViewProps> = ({ flatHeadings, auditUrl }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useTransientValue(false, 2000);

  const handleCopyMarkdownTree = async () => {
    const lines = flatHeadings.map((node) => `${'#'.repeat(node.level)} ${node.text}`);
    const ok = await copyText(lines.join('\n'));
    if (!ok) return;
    setCopied(true);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
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
                <span className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md border shrink-0 ${getLevelBadgeClass(node.level)}`}>
                  {t('uiUnits.headingLevel', { level: node.level })}
                </span>
                <span className="text-xs text-slate-300 font-medium group-hover:text-white transition break-words">
                  {node.text || <span className="text-slate-500 italic">{t('legacyUi.headings.empty')}</span>}
                </span>
                <ShowOnPageButton
                  url={auditUrl}
                  selector={`h${node.level}`}
                  needle={node.text || undefined}
                  label={`H${node.level} ${node.text || t('legacyUi.headings.emptyLabel')}`}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
