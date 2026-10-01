import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";
import { useProjectStore } from "@/stores/projectStore";

import type { CrawlRunRecord, SiteCrawlResult } from "@/types";
import i18n from "@/i18n";
import { result, run } from "./fixtures/crawlResultsTabsContracts";

describe("CrawlResultsTabs", () => {
afterEach(async () => {
    await i18n.changeLanguage('en');
  });

beforeEach(async () => {
    await i18n.changeLanguage('en');
   localStorage.clear();
    window.history.replaceState(null, "", "/");
    useProjectStore.setState({ activeProjectId: null });
  });

it("shows image HTTP and byte data only for images checked in the selected run", () => {
    const imageResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              images: [
                {
                  src: "https://example.com/checked.webp",
                  alt: "Checked",
                  format: "webp",
                  width: 2,
                  height: 3,
                  dimensions_source: "intrinsic-data-uri",
                  lazy_loaded: false,
                  checked_in_run: true,
                  http_status: 404,
                  content_length: 4096,
                  srcset: "responsive.webp 2x",
                  srcset_resource_checks: [
                    {
                      url: "https://example.com/responsive.webp",
                      checked_in_run: true,
                      http_status: 200,
                      content_length: 2048,
                    },
                  ],
                },
                {
                  src: "https://example.com/unknown.webp",
                  alt: "Unknown",
                  format: "webp",
                  lazy_loaded: false,
                  checked_in_run: false,
                },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={imageResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Media/ }));

    expect(screen.getByText("HTTP 404")).not.toBeNull();
    expect(screen.getByText(i18n.t("crawl.ui.notChecked"))).not.toBeNull();
    expect(screen.getByText(/4.?096 B/)).not.toBeNull();
    fireEvent.click(screen.getByText(i18n.t("uiUnits.srcsetVariants", { count: 1 })));
    expect(screen.getByText("HTTP 200")).not.toBeNull();
    expect(screen.getByText(/responsive\.webp/)).not.toBeNull();
    expect(
      screen.getByText(new RegExp(i18n.t("crawl.ui.dimensionSources.attributes"))),
    ).not.toBeNull();
    expect(screen.getByText(/intrinsic data URI/)).not.toBeNull();
  });

it("previews stored CSS/XPath custom-search values from the selected run", () => {
    const customSearch = {
      id: "sku",
      name: "SKU",
      selectorType: "css" as const,
      query: "[data-sku]",
      resultType: "attribute" as const,
      attribute: "data-sku",
    };
    const customResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              custom_search_results: [
                {
                  id: "sku",
                  values: ["SKU-123"],
                  error: null,
                  truncated: false,
                },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;
    const customRun = {
      ...run,
      config: { ...run.config, customSearches: [customSearch] },
      result: customResult,
    } as CrawlRunRecord;
    render(
      <CrawlResultsTabs
        result={customResult}
        runs={[customRun]}
        selectedRun={customRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Custom search/ }));

    expect(screen.getByText("CSS: [data-sku]")).not.toBeNull();
    expect(screen.getByText("SKU-123")).not.toBeNull();
    expect(
      screen.getByText("Result unavailable in an older run"),
    ).not.toBeNull();
  });
});
