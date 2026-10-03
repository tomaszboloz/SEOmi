import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DEFAULT_CRAWL_REPORT_TEMPLATE,
  REPORT_TEMPLATE_SECTIONS,
  deleteCrawlReportTemplate,
  loadCrawlReportTemplates,
  loadSelectedCrawlReportTemplateId,
  saveCrawlReportTemplate,
  saveSelectedCrawlReportTemplateId,
  type CrawlReportTemplate,
  type ReportTemplateSection,
} from "@/services/reportTemplates";

export const useCrawlTemplates = (activeProjectId: string | null) => {
  const { t } = useTranslation();
  const [reportTemplates, setReportTemplates] = useState<CrawlReportTemplate[]>([DEFAULT_CRAWL_REPORT_TEMPLATE]);
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState(DEFAULT_CRAWL_REPORT_TEMPLATE.id);
  const [reportTemplateName, setReportTemplateName] = useState("");
  const [reportTemplateSections, setReportTemplateSections] = useState<ReportTemplateSection[]>(DEFAULT_CRAWL_REPORT_TEMPLATE.sections);
  const [reportTemplateError, setReportTemplateError] = useState<string | null>(null);

  useEffect(() => {
    const templates = loadCrawlReportTemplates(activeProjectId);
    const selectedId = loadSelectedCrawlReportTemplateId(activeProjectId);
    const selected = templates.find((template) => template.id === selectedId) || templates[0] || DEFAULT_CRAWL_REPORT_TEMPLATE;
    setReportTemplates(templates);
    setSelectedReportTemplateId(selected.id);
    setReportTemplateSections(selected.sections);
    setReportTemplateName(selected.builtIn ? "" : selected.name);
    setReportTemplateError(null);
  }, [activeProjectId]);

  const selectReportTemplate = (templateId: string) => {
    const template = reportTemplates.find((candidate) => candidate.id === templateId) || DEFAULT_CRAWL_REPORT_TEMPLATE;
    setSelectedReportTemplateId(template.id);
    setReportTemplateSections(template.sections);
    setReportTemplateName(template.builtIn ? "" : template.name);
    setReportTemplateError(null);
    if (activeProjectId) saveSelectedCrawlReportTemplateId(activeProjectId, template.id);
  };

  const toggleReportTemplateSection = (section: ReportTemplateSection) => {
    setReportTemplateSections((current) =>
      current.includes(section) ? current.filter((item) => item !== section) : [...current, section],
    );
  };

  const createReportTemplate = () => {
    if (!activeProjectId) {
      setReportTemplateError(t("siteAudit.templateProjectRequired"));
      return;
    }
    try {
      const template = saveCrawlReportTemplate(activeProjectId, { name: reportTemplateName, sections: reportTemplateSections });
      const templates = loadCrawlReportTemplates(activeProjectId);
      setReportTemplates(templates);
      setSelectedReportTemplateId(template.id);
      saveSelectedCrawlReportTemplateId(activeProjectId, template.id);
      setReportTemplateName(template.name);
      setReportTemplateError(null);
    } catch (error) {
      setReportTemplateError(error instanceof Error ? error.message : t("siteAudit.templateSaveError"));
    }
  };

  const selectedReportTemplate = reportTemplates.find((template) => template.id === selectedReportTemplateId) || DEFAULT_CRAWL_REPORT_TEMPLATE;

  const removeReportTemplate = () => {
    if (!activeProjectId || selectedReportTemplate.builtIn) return;
    deleteCrawlReportTemplate(activeProjectId, selectedReportTemplate.id);
    const templates = loadCrawlReportTemplates(activeProjectId);
    setReportTemplates(templates);
    selectReportTemplate(templates[0]?.id || DEFAULT_CRAWL_REPORT_TEMPLATE.id);
  };

  const reportTemplateSectionLabels = Object.fromEntries(
    REPORT_TEMPLATE_SECTIONS.map((section) => [section, t(`siteAudit.reportSections.${section}`)])
  ) as Record<ReportTemplateSection, string>;

  return {
    reportTemplates,
    selectedReportTemplate,
    reportTemplateName,
    reportTemplateSections,
    reportTemplateError,
    reportTemplateSectionLabels,
    setReportTemplateName,
    toggleReportTemplateSection,
    createReportTemplate,
    removeReportTemplate,
    selectReportTemplate,
  };
};
