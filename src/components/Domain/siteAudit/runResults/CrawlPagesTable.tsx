import { CrawlPageErrors } from '../CrawlPageErrors';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlPagesTable = ({ session }: { session: Session }) => {
  const { t } = session;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">{t("siteAudit.pageUrlTitle")}</th>
              <th className="px-4 py-3 text-center">{t("siteAudit.status")}</th>
              <th className="px-4 py-3 text-center">{t("siteAudit.depth")}</th>
              <th className="px-4 py-3 text-center">{t("siteAudit.h1Count")}</th>
              <th className="px-4 py-3 text-right">{t("siteAudit.speed")}</th>
              <th className="px-4 py-3 text-right">{t("siteAudit.issues")}</th>
            </tr>
          </thead>
          <CrawlPageErrors session={session} />
        </table>
      </div>
    </div>
  );
};
