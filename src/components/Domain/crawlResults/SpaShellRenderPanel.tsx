import { useTranslation } from 'react-i18next';
import { MAX_SHELL_RENDERS, useSpaShellRender, type ShellRenderRow } from '@/hooks/useSpaShellRender';
import { isTauriEnvironment } from '@/services/tauri/transport';
import type { CrawledPageSummary, RenderedPageSnapshot } from '@/types';

const signed = (value: number): string => `${value > 0 ? '+' : ''}${value}`;

const RowResult = ({ row }: { row: ShellRenderRow }) => {
  const { t } = useTranslation();
  if (row.status === 'error') return <span className="text-rose-300">{t('crawl.spaRender.error', { error: row.error })}</span>;
  if (row.status !== 'done') return <span className="text-slate-400">{t(`crawl.spaRender.status.${row.status}`)}</span>;
  const { raw, rendered, wordDelta, htmlTruncated, consoleErrors } = row.comparison;
  return (
    <span className="text-slate-200">
      {t('crawl.spaRender.words', { raw: raw.words, rendered: rendered.words, delta: signed(wordDelta) })}
      {' · '}{t('crawl.spaRender.links', { raw: raw.internalLinks, rendered: rendered.internalLinks })}
      {raw.title !== rendered.title && rendered.title ? ` · ${t('crawl.spaRender.title', { title: rendered.title })}` : ''}
      {htmlTruncated ? ` · ${t('crawl.spaRender.truncated')}` : ''}
      {consoleErrors ? ` · ${t('crawl.spaRender.consoleErrors', { count: consoleErrors })}` : ''}
    </span>
  );
};

/**
 * On-demand browser render of flagged shells (#131): static HTML next to the rendered DOM.
 * Evidence only; crawl scores are unchanged.
 */
export const SpaShellRenderPanel = ({ shells, render }: { shells: CrawledPageSummary[]; render?: (url: string) => Promise<RenderedPageSnapshot> }) => {
  const { t } = useTranslation();
  const { rows, running, start, cancel } = useSpaShellRender(shells, render);
  if (!render && !isTauriEnvironment()) return <p className="text-amber-200/80">{t('crawl.spaRender.desktopOnly')}</p>;
  return (
    <div className="space-y-2" data-testid="spa-render-panel">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={running ? cancel : start}
          className="rounded border border-amber-400/50 px-2 py-1 text-amber-100 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {running ? t('crawl.spaRender.cancel') : t('crawl.spaRender.start', { count: Math.min(MAX_SHELL_RENDERS, shells.length) })}
        </button>
        <span className="text-amber-200/70">{t('crawl.spaRender.note')}</span>
      </div>
      {rows.length > 0 && (
        <ul aria-live="polite" className="space-y-1 font-mono text-[11px]">
          {rows.map((row) => (
            <li key={row.url} className="break-all"><span className="text-slate-300">{row.url}</span> — <RowResult row={row} /></li>
          ))}
        </ul>
      )}
    </div>
  );
};
