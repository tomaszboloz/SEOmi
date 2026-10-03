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

it("shows faceted metadata findings and remembers the selected facet per project and run", () => {
    useProjectStore.setState({ activeProjectId: "project-a" });
    const metadataResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          title: "Short title",
          title_length: 11,
          meta_description: "A short description",
          meta_description_length: 19,
          issues: [
            { severity: "Info", message: "Title length is 11 characters; reference range is 30–60" },
            { severity: "Info", message: "Meta description length is 19 characters; reference range is 70–160" },
            { severity: "Warning", message: "Duplicate title found in this crawl" },
          ],
        },
        {
          ...result.pages[1],
          title: "",
          title_length: 0,
          meta_description: undefined,
          meta_description_length: undefined,
          issues: [
            { severity: "Critical", message: "Missing <title> tag" },
            { severity: "Warning", message: "Meta description is empty" },
            { severity: "Warning", message: "Duplicate meta description found in this crawl" },
          ],
        },
        {
          ...result.pages[1],
          url: "https://example.com/manual.pdf",
          final_url: "https://example.com/manual.pdf",
          content_type: "application/pdf",
          title: undefined,
          meta_description: undefined,
          issues: [],
        },
      ],
    } as SiteCrawlResult;
    const metadataRun = { ...run, result: metadataResult };
    const view = render(
      <CrawlResultsTabs
        result={metadataResult}
        runs={[metadataRun]}
        selectedRun={metadataRun}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Metadata/ }));
    expect(screen.getByRole("tab", { name: /Metadata 2/ })).not.toBeNull();
    expect(screen.getByText(/Faceted metadata report/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Title out of range · 1/ })).not.toBeNull();
    expect(screen.getByRole("button", { name: /Empty title · 1/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Empty title · 1/ }));
    expect(screen.getByText(i18n.t("crawl.ui.emptyValue"))).not.toBeNull();
    expect(screen.queryByText("Short title")).toBeNull();

    view.unmount();
    render(
      <CrawlResultsTabs
        result={metadataResult}
        runs={[metadataRun]}
        selectedRun={metadataRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Metadata/ }));
    expect(screen.getByRole("button", { name: /Empty title · 1/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("https://example.com/manual.pdf")).toBeNull();
  });

it("renders native snapshots that encode optional metadata as null", () => {
    const nativeResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          title: null,
          title_length: null,
          meta_description: null,
          meta_description_length: null,
        },
      ],
    } as unknown as SiteCrawlResult;
    const nativeRun = { ...run, result: nativeResult };

    render(
      <CrawlResultsTabs
        result={nativeResult}
        runs={[nativeRun]}
        selectedRun={nativeRun}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Metadata/ }));
    expect(screen.getByText(i18n.t("crawl.ui.missingTag"))).not.toBeNull();
    expect(screen.getByText(i18n.t("crawl.ui.missingTagOrData"))).not.toBeNull();
  });

it("supports Home/End navigation for the long result tab strip", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

const tabList = screen.getByRole("tablist", { name: "Crawl results" });
    fireEvent.keyDown(tabList, { key: "End" });
expect(screen.getByRole("tab", { name: /Exports/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(tabList, { key: "Home" });
expect(screen.getByRole("tab", { name: /Overview/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Scroll tabs to the beginning" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scroll tabs to the end" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scroll results to the beginning" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Scroll results to the end" })).not.toBeNull();
  });
});
