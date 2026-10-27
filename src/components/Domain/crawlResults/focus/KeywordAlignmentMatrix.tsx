import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { AlignmentLevel, AlignmentRow } from '@/services/siteFocus';
import { Table } from '../CrawlViewPrimitives';
import { formatPct } from './focusText';

const SYMBOL: Record<AlignmentLevel, { mark: string; key: string; tone: string }> = {
  strong: { mark: '✓', key: 'match', tone: 'text-emerald-300' },
  moderate: { mark: '~', key: 'partial', tone: 'text-amber-300' },
  weak: { mark: '✗', key: 'miss', tone: 'text-rose-300' },
};

export const KeywordAlignmentMatrix = ({ rows }: { rows: AlignmentRow[] }) => {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="focus-matrix-title" className="space-y-2">
      <h3 id="focus-matrix-title" className="flex items-center gap-1 text-sm font-semibold text-slate-200">
        {t('focus.matrix.title')} <HelpTip id="focus.keywordAlignment" />
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{t('focus.matrix.empty')}</p>
      ) : (
        <Table minWidth="min-w-[420px]">
          <thead className="text-slate-400">
            <tr>
              <th scope="col" className="px-2 py-1">{t('focus.matrix.keyword')}</th>
              <th scope="col" className="px-2 py-1">{t('focus.matrix.freq')}</th>
              <th scope="col" className="px-2 py-1">{t('focus.matrix.relevance')}</th>
              <th scope="col" className="px-2 py-1">{t('focus.matrix.alignment')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const symbol = SYMBOL[row.level];
              return (
                <tr key={row.term} className="border-t border-slate-800 text-slate-200">
                  <th scope="row" className="px-2 py-1 font-normal">{row.term}</th>
                  <td className="px-2 py-1 tabular-nums">{row.freq}</td>
                  <td className="px-2 py-1 tabular-nums">{formatPct(row.relevancePct)}%</td>
                  <td className={`px-2 py-1 font-semibold ${symbol.tone}`}>
                    <span role="img" aria-label={t(`focus.matrix.${symbol.key}`)}>{symbol.mark}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </section>
  );
};
