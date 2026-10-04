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

  const updateReportTemplateState = (template: CrawlReportTemplate) => {
    setSelectedReportTemplateId(template.id);
    setReportTemplateSections(template.sections);
    setReportTemplateName(template.builtIn ? "" : template.name);
  };

  const applyReportTemplate = (template: CrawlReportTemplate) => {
    if (activeProjectId) saveSelectedCrawlReportTemplateId(activeProjectId, template.id);
    updateReportTemplateState(template);
    setReportTemplateError(null);
  };

  const selectReportTemplate = (templateId: string) => {
    try {
      applyReportTemplate(reportTemplates.find((candidate) => candidate.id === templateId) || DEFAULT_CRAWL_REPORT_TEMPLATE);
    } catch (error) {
      setReportTemplateError(error instanceof Error ? error.message : t("siteAudit.templateSaveError"));
    }
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
      applyReportTemplate(template);
    } catch (error) {
      setReportTemplateError(error instanceof Error ? error.message : t("siteAudit.templateSaveError"));
    }
  };

  const selectedReportTemplate = reportTemplates.find((template) => template.id === selectedReportTemplateId) || DEFAULT_CRAWL_REPORT_TEMPLATE;

  const removeReportTemplate = () => {
    if (!activeProjectId || selectedReportTemplate.builtIn) return;
    try {
      deleteCrawlReportTemplate(activeProjectId, selectedReportTemplate.id);
      const templates = loadCrawlReportTemplates(activeProjectId);
      applyReportTemplate(templates[0] || DEFAULT_CRAWL_REPORT_TEMPLATE);
      setReportTemplates(templates);
    } catch (error) {
      const templates = loadCrawlReportTemplates(activeProjectId);
      setReportTemplates(templates);
      if (!templates.some((template) => template.id === selectedReportTemplate.id)) {
        updateReportTemplateState(templates[0] || DEFAULT_CRAWL_REPORT_TEMPLATE);
      }
      setReportTemplateError(error instanceof Error ? error.message : t("siteAudit.templateSaveError"));
    }
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
