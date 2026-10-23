import { useTranslation } from 'react-i18next';

/** Shown when a crawl finished after a simulation snapshot was opened. */
export const StaleSnapshotBanner = ({ stale, onRefresh }: { stale: boolean; onRefresh: () => void }) => {
  const { t } = useTranslation();
  if (!stale) return null;
  return (
    <p role="status" data-testid="stale-snapshot-banner" className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-100">
      <span>{t('snapshots.newerData')}</span>
      <button type="button" className="underline" onClick={onRefresh}>{t('snapshots.refresh')}</button>
    </p>
  );
};
