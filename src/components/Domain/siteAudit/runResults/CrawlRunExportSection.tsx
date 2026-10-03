import { CrawlExportActions } from '../CrawlExportActions';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlRunExportSection = ({ session }: { session: Session }) => {
  const { crawlPdfError, selectedRun, t } = session;

  if (!selectedRun) {
    return (
      <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        {t("siteAudit.legacyExportUnavailable")}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">
          {t("siteAudit.exportTitle")}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {t("siteAudit.exportDescription")}
        </p>
      </div>
      <CrawlExportActions session={session} />
      {crawlPdfError && (
        <p role="alert" className="text-xs text-rose-300">
          {crawlPdfError}
        </p>
      )}
    </section>
  );
};
