import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import { detectConflicts, type GatePage } from '@/services/indexabilityGate';
import type { SiteFocusReport } from '@/services/siteFocus';
import { gateSkippedCount } from '@/services/siteFocus/gate';

interface Props {
  report: SiteFocusReport;
  pages: readonly GatePage[];
  included: boolean;
  onToggle: () => void;
  /** Real evidence only; absent maps mean unknown. */
  clicks?: ReadonlyMap<string, number>;
  referringDomains?: ReadonlyMap<string, number>;
  sitemapUrls?: readonly string[];
}

const box = 'flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-100';

/** "Skipped N pages (noindex/canonical)" counter with opt-in, plus directive conflicts. */
export const GateBanner = ({ report, pages, included, onToggle, clicks, referringDomains, sitemapUrls }: Props) => {
  const { t } = useTranslation();
  const skipped = gateSkippedCount(report.pages);
  const conflicts = detectConflicts({ pages, clicks, referringDomains, sitemapUrls });
  if (!skipped && !included && !conflicts.length) return null;
  return (
    <div className="space-y-2" data-testid="gate-banner">
      <p role="status" className={box}>
        <span>{t('focus.banner.gateSkipped', { count: included ? 0 : skipped })}</span>
        <button type="button" className="underline" onClick={onToggle}>{t(included ? 'focus.banner.gateExclude' : 'focus.banner.gateInclude')}</button>
        <HelpTip id="focus.indexGate" />
      </p>
      {conflicts.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-100" data-testid="gate-conflicts">
          {conflicts.map((c) => (
            <li key={`${c.code}:${c.url}`}>{t(`focus.conflict.${c.code}`, { url: c.url, inlinks: c.detail.inlinks, clicks: c.detail.clicks, domains: c.detail.referringDomains })}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
