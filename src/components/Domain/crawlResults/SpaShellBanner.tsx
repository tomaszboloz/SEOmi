import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { CrawledPageSummary } from '@/types';
import { SpaShellRenderPanel } from './SpaShellRenderPanel';

type ShellReason = NonNullable<CrawledPageSummary['js_shell_reason']> | 'unknown';
const REASONS: ShellReason[] = ['next_data', 'nuxt_payload', 'initial_state', 'bundle_empty_root', 'unknown'];

const reasonOf = (page: CrawledPageSummary): ShellReason =>
  page.js_shell_reason && REASONS.includes(page.js_shell_reason) ? page.js_shell_reason : 'unknown';

/** Counts only what the crawler recorded: flagged shells, their reason, and shells with a payload read. */
export const summarizeJsShells = (pages: CrawledPageSummary[] | undefined) => {
  // Saved runs restored from older or degraded storage may lack a page list.
  const shells = (Array.isArray(pages) ? pages : []).filter((page) => page.is_js_shell_suspected === true);
  const reasons = REASONS
    .map((reason) => ({ reason, count: shells.filter((page) => reasonOf(page) === reason).length }))
    .filter((entry) => entry.count > 0);
  return { shells, reasons, withPayload: shells.filter((page) => page.spa_payload).length };
};

/**
 * Warns that some pages were analysed from a near-empty static HTML shell.
 * Payload text is never presented as rendered content; only its word count is
 * shown and it is labelled as coming from the JS payload. Scoring is untouched.
 */
export const SpaShellBanner = ({ pages }: { pages: CrawledPageSummary[] | undefined }) => {
  const { t } = useTranslation();
  // Memoised: the render panel resets its batch whenever the shell list identity changes.
  const { shells, reasons, withPayload } = useMemo(() => summarizeJsShells(pages), [pages]);
  if (shells.length === 0) return null;
  return (
    <div role="status" data-testid="spa-shell-banner"
      className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
      <p className="flex items-start gap-2">
        <span>{t('crawl.spaShell.summary', { count: shells.length })}</span>
        <HelpTip id="overview.jsShell" />
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-amber-200/90">
        {reasons.map(({ reason, count }) => (
          <li key={reason} data-reason={reason}>
            {t('crawl.spaShell.reasonCount', { reason: t(`crawl.spaShell.reasons.${reason}`), count })}
          </li>
        ))}
      </ul>
      <p className="text-amber-200/80">
        {withPayload > 0
          ? t('crawl.spaShell.payloadRead', { count: withPayload, total: shells.length })
          : t('crawl.spaShell.noPayload')}
      </p>
      <details>
        <summary className="cursor-pointer font-medium">{t('crawl.spaShell.showUrls')}</summary>
        <ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono text-[11px] text-slate-300">
          {shells.map((page) => (
            <li key={page.url}>
              {page.url} — {t(`crawl.spaShell.reasons.${reasonOf(page)}`)}
              {page.spa_payload ? ` — ${t('crawl.spaShell.payloadWords', { count: page.spa_payload.word_count })}` : ''}
            </li>
          ))}
        </ul>
      </details>
      <SpaShellRenderPanel shells={shells} />
    </div>
  );
};
