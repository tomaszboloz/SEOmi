import { REPORT_TEMPLATE_SECTIONS } from "@/services/reportTemplates";
import { ContextHelp } from "@/components/ContextHelp";
import { CrawlReportTemplateSelector } from '../CrawlReportTemplateSelector';
import type { useSiteAuditSession } from '../useSiteAuditSession';

type Session = ReturnType<typeof useSiteAuditSession>;

export const CrawlReportTemplateSection = ({ session }: { session: Session }) => {
  const {
    reportTemplateError,
    reportTemplateSectionLabels,
    reportTemplateSections,
    selectedReportTemplate,
    selectedRun,
    t,
    toggleReportTemplateSection,
  } = session;

  if (!selectedRun) return null;

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-100">
        {t("siteAudit.reportTemplate")} · {selectedReportTemplate.name}
      </summary>
      <div className="mt-3 space-y-3">
        <ContextHelp id="crawl-report-template-help" label={t("siteAudit.reportTemplateHelp")}>
          {t("siteAudit.reportTemplateHelp")}
        </ContextHelp>
        <p id="crawl-report-template-description" className="sr-only">
          {t("siteAudit.reportTemplateHelp")}
        </p>
        <CrawlReportTemplateSelector session={session} />
        <fieldset aria-describedby="crawl-report-template-description" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("siteAudit.reportSectionsLegend")}
          </legend>
          {REPORT_TEMPLATE_SECTIONS.filter((section) => section !== "summary").map((section) => (
            <label
              key={section}
              className="flex items-center gap-2 text-xs text-slate-300"
            >
              <input
                type="checkbox"
                checked={reportTemplateSections.includes(section)}
                onChange={() => toggleReportTemplateSection(section)}
              />
              {reportTemplateSectionLabels[section]}
            </label>
          ))}
        </fieldset>
        <p className="text-[10px] leading-4 text-slate-500">
          {t("siteAudit.reportTemplateDescription")}
        </p>
        {reportTemplateError && (
          <p role="alert" className="text-xs text-rose-300">
            {reportTemplateError}
          </p>
        )}
      </div>
    </details>
  );
};
