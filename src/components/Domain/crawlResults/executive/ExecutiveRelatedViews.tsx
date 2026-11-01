import { useTranslation } from 'react-i18next';
import type { CrawlTab } from '../helpers/crawlResultsTabsConfig';

/** Existing screens that hold the 360 add-on evidence (#73 GEM-73-04): links/off-page, media, international, performance, URLs. */
export const RELATED_TABS: CrawlTab[] = ['links', 'media', 'international', 'performance', 'urls'];

export const ExecutiveRelatedViews = ({ onOpen }: { onOpen: (tab: CrawlTab) => void }) => {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('executive.related.title')} className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
      <span>{t('executive.related.title')}</span>
      {RELATED_TABS.map((tab) => (
        <button key={tab} type="button" onClick={() => onOpen(tab)} className="rounded border border-slate-700 px-2 py-1 text-slate-200 hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          {t(`crawl.tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
};
