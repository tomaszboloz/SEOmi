import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";
import { useProjectStore } from "@/stores/projectStore";

import type { SiteCrawlResult } from "@/types";
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

it("shows local HTML validation and charset evidence for the affected URL", () => {
    useProjectStore.setState({ activeProjectId: "project-validation" });
    const validationResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              charset: "windows-1252",
              detected_charset: "windows-1252",
              html_validation_findings: [
                {
                  code: "html-uri-invalid",
                  severity: "Warning",
                  message: "Malformed URI evidence",
                  element: "a",
                  attribute: "href",
                  value: "/bad%ZZ",
                  line: 4,
                  column: 18,
                  source_excerpt: '<a href="/bad%ZZ">bad</a>',
                },
              ],
              html_validation_truncated: false,
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={validationResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /HTML validation/ }));

    expect(screen.getAllByText("windows-1252")).toHaveLength(2);
    expect(screen.getByText(/html-uri-invalid/)).not.toBeNull();
    expect(
      screen.getByText(new RegExp(`${i18n.t("crawlDeepUi.line")} 4:18`)),
    ).not.toBeNull();
    expect(screen.getByText("/bad%ZZ")).not.toBeNull();
    expect(screen.getByText('<a href="/bad%ZZ">bad</a>')).not.toBeNull();
    expect(screen.getAllByText("https://example.com/").length).toBeGreaterThan(
      1,
    );

    const validationSearch = screen.getByRole("textbox", {
      name: i18n.t("crawl.ui.searchHtmlValidation"),
    });
    fireEvent.change(validationSearch, { target: { value: "does-not-exist" } });
    expect(
      screen.getByText(i18n.t("crawl.ui.noHtmlFindings")),
    ).not.toBeNull();
    fireEvent.change(validationSearch, { target: { value: "html-uri-invalid" } });
    expect(screen.getByText(/html-uri-invalid/)).not.toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: i18n.t("crawl.ui.validationSeverity") }), {
      target: { value: "Error" },
    });
    expect(
      screen.getByText(i18n.t("crawl.ui.noHtmlFindings")),
    ).not.toBeNull();
    const navigationKey = "seomi_project_project-validation_crawl_navigation_run-1_v1";
    expect(localStorage.getItem(navigationKey)).toContain('"validationQuery":"html-uri-invalid"');
    expect(localStorage.getItem(navigationKey)).toContain('"validationSeverity":"Error"');
  });
});
