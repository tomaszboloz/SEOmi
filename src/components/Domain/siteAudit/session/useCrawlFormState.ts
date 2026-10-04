import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToolsStore } from "@/stores/toolsStore";
import type { SiteAuditSessionDependencies } from "../contracts";
import type { CustomSearchDefinition } from "@/types";
import { useCrawlOperationScope } from "./useCrawlOperationScope";

export const useCrawlFormState = (
  activeProjectId: string | null,
  services: SiteAuditSessionDependencies
) => {
  const { t } = useTranslation();
  const crawlUrl = useToolsStore((s) => s.crawlUrl);
  const crawlLimit = useToolsStore((s) => s.crawlLimit);
  const crawlConfig = useToolsStore((s) => s.crawlConfig);
  const setCrawlConfig = useToolsStore((s) => s.setCrawlConfig);
  const saveCrawlRequestProfile = useToolsStore((s) => s.saveCrawlRequestProfile);
  const deleteCrawlRequestProfile = useToolsStore((s) => s.deleteCrawlRequestProfile);
  const crawlRequestProfiles = useToolsStore((s) => s.crawlRequestProfiles);

  const [inputUrl, setInputUrl] = useState(crawlUrl);
  const [selectedLimit, setSelectedLimit] = useState(crawlLimit);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [seedImportRejected, setSeedImportRejected] = useState<string[]>([]);

  const [requestProfileName, setRequestProfileName] = useState("");
  const [requestProfileHeaders, setRequestProfileHeaders] = useState("");
  const [requestProfileCookie, setRequestProfileCookie] = useState("");
  const [requestProfileProxyUrl, setRequestProfileProxyUrl] = useState("");
  const [requestProfileStatus, setRequestProfileStatus] = useState<string | null>(null);
  const [requestProfileStatusIsError, setRequestProfileStatusIsError] = useState(false);

  const beginImport = useCrawlOperationScope(activeProjectId);
  const beginProfile = useCrawlOperationScope(JSON.stringify([activeProjectId, requestProfileName,
    requestProfileHeaders, requestProfileCookie, requestProfileProxyUrl]));

  useEffect(() => {
    setInputUrl(crawlUrl);
    setSelectedLimit(crawlLimit);
  }, [activeProjectId, crawlLimit, crawlUrl]);

  useEffect(() => {
    setExpandedRows({});
    setSeedImportRejected([]);
    setRequestProfileName("");
    setRequestProfileHeaders("");
    setRequestProfileCookie("");
    setRequestProfileProxyUrl("");
    setRequestProfileStatus(null);
    setRequestProfileStatusIsError(false);
  }, [activeProjectId]);

  const toggleRow = (url: string) => {
    setExpandedRows((prev) => ({ ...prev, [url]: !prev[url] }));
  };

  const importSeedUrls = async (file: File | undefined) => {
    if (!file) return;
    const isCurrent = beginImport("import");
    const content = await file.text();
    if (!isCurrent()) return;
    const imported = services.importUrls(content);
    setSeedImportRejected(imported.rejected);
    setCrawlConfig({ seedUrls: imported.urls.slice(0, 10_000), listMode: true });
  };

  const customSearches = crawlConfig.customSearches || [];
  const updateCustomSearch = (id: string, patch: Partial<CustomSearchDefinition>) => {
    setCrawlConfig({ customSearches: customSearches.map((search) => (search.id === id ? { ...search, ...patch } : search)) });
  };
  const addCustomSearch = () => {
    if (customSearches.length >= 10) return;
    const id = globalThis.crypto?.randomUUID?.() || `custom-search-${Date.now()}`;
    setCrawlConfig({
      customSearches: [
        ...customSearches,
        { id, name: t("crawl.customSearch.defaultName", { count: customSearches.length + 1 }), selectorType: "css", query: "h1", resultType: "text" },
      ],
    });
  };

  const saveRequestProfile = async () => {
    const isCurrent = beginProfile("profile");
    setRequestProfileStatus(null);
    setRequestProfileStatusIsError(false);
    try {
      const headers = requestProfileHeaders.split("\n").filter((line) => line.trim()).map((line) => {
        const separator = line.indexOf(":");
        if (separator < 1) throw new Error(t("siteAudit.headerFormatError", { line }));
        return { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
      });
      await saveCrawlRequestProfile({ name: requestProfileName, userAgent: crawlConfig.userAgent || "", headers, cookie: requestProfileCookie, proxyUrl: requestProfileProxyUrl });
      if (!isCurrent()) return;
      setRequestProfileName(""); setRequestProfileHeaders(""); setRequestProfileCookie(""); setRequestProfileProxyUrl("");
      setRequestProfileStatus(t("siteAudit.profileSaved")); setRequestProfileStatusIsError(false);
    } catch (error) {
      if (!isCurrent()) return;
      setRequestProfileStatusIsError(true); setRequestProfileStatus(error instanceof Error ? error.message : t("siteAudit.profileSaveError"));
    }
  };

  const selectRequestProfile = (id: string) => {
    beginProfile("profile");
    const profile = crawlRequestProfiles.find((candidate) => candidate.id === id);
    setCrawlConfig({ requestProfileId: id || undefined, userAgent: profile?.userAgent || crawlConfig.userAgent });
    setRequestProfileStatusIsError(false); setRequestProfileStatus(profile ? t("siteAudit.profileSelected", { name: profile.name }) : null);
  };

  const removeRequestProfile = async () => {
    if (!crawlConfig.requestProfileId) return;
    const isCurrent = beginProfile("profile");
    try {
      await deleteCrawlRequestProfile(crawlConfig.requestProfileId);
      if (!isCurrent()) return;
      setRequestProfileStatusIsError(false); setRequestProfileStatus(t("siteAudit.profileRemoved"));
    } catch (error) {
      if (!isCurrent()) return;
      setRequestProfileStatusIsError(true); setRequestProfileStatus(error instanceof Error ? error.message : t("siteAudit.profileRemoveError"));
    }
  };

  const setQueryParameterNames = (field: "allowedQueryParameters" | "deniedQueryParameters", value: string) => {
    setCrawlConfig({ [field]: value.split(/[\n,]/).map((name) => name.trim()).filter(Boolean) });
  };
  const setAllowedHosts = (value: string) => {
    setCrawlConfig({ allowedHosts: value.split(/[\n,]/).map((host) => host.trim()).filter(Boolean) });
  };

  return {
    inputUrl, setInputUrl, selectedLimit, setSelectedLimit, expandedRows, toggleRow, seedImportRejected, importSeedUrls,
    customSearches, updateCustomSearch, addCustomSearch, requestProfileName, setRequestProfileName, requestProfileHeaders,
    setRequestProfileHeaders, requestProfileCookie, setRequestProfileCookie, requestProfileProxyUrl, setRequestProfileProxyUrl,
    requestProfileStatus, requestProfileStatusIsError, saveRequestProfile, selectRequestProfile, removeRequestProfile,
    setQueryParameterNames, setAllowedHosts
  };
};
