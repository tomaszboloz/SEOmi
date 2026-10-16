import { useTranslation } from 'react-i18next';
import { HelpTip } from '@/components/Help/HelpTip';
import type { SiteFocusReport } from '@/services/siteFocus';

const box = 'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs';
const amber = `${box} border-amber-500/30 bg-amber-500/5 text-amber-100`;
const sky = `${box} border-sky-500/30 bg-sky-500/5 text-sky-100`;

export const FocusBanners = ({ report }: { report: SiteFocusReport }) => {
  const { t } = useTranslation();
  const { flags } = report;
  const unmatched = report.coreTopic.manualOverride && !report.coreTopic.manualOverride.matched
    ? report.coreTopic.manualOverride.input : '';
  return (
    <div className="space-y-2" data-testid="focus-banners">
      {flags.isLowConfidence && (
        <p role="status" className={amber}>
          <span>{t('focus.banner.lowConfidence', { count: report.pageCount })}</span>
          <HelpTip id="focus.lowConfidence" />
        </p>
      )}
      {flags.isMultiTopic && (
        <p role="status" className={sky}>{t('focus.banner.multiTopic', { count: report.subSites?.length ?? 0 })}</p>
      )}
      {flags.fallbackMode === 'lexical' && <p role="status" className={sky}>{t('focus.banner.lexicalFallback')}</p>}
      {flags.skippedRenderTimeouts > 0 && (
        <p role="status" className={amber}>{t('focus.banner.skippedRender', { count: flags.skippedRenderTimeouts })}</p>
      )}
      {flags.degraded && <p role="status" className={sky}>{t('focus.banner.degraded')}</p>}
      {unmatched && <p role="status" className={amber}>{t('focus.banner.unmatchedTopic', { topic: unmatched })}</p>}
    </div>
  );
};
