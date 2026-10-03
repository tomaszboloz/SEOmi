import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CrawlResultsTabs } from "@/components/Domain/CrawlResultsTabs";
import { useProjectStore } from "@/stores/projectStore";
import { useToolsStore } from "@/stores/toolsStore";

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

it("filters to pages with recorded issues and opens a stable URL evidence link", () => {
    useProjectStore.setState({ activeProjectId: "project-a" });
    const healthyPage = {
      ...result.pages[0],
      url: "https://example.com/healthy",
      final_url: "https://example.com/healthy",
      title: "Healthy page",
      issues: [],
      issues_count: 0,
    };
    const testResult = {
      ...result,
      pages_crawled: 3,
      pages: [...result.pages, healthyPage],
    } as SiteCrawlResult;
    const onSelectRun = vi.fn();
    render(
      <CrawlResultsTabs
        result={testResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={onSelectRun}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    fireEvent.click(screen.getByLabelText(i18n.t("crawl.ui.onlyProblems")));
    let cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).not.toContain("https://example.com/healthy");
    expect(cells).toContain("https://example.com/missing");

    fireEvent.click(screen.getByLabelText(i18n.t("crawl.ui.onlyProblems")));
    const evidenceLink = screen.getByRole("link", {
      name: i18n.t("crawl.ui.openEvidence", { url: "https://example.com/missing" }),
    });
    expect(evidenceLink.getAttribute("href")).toContain(
      "crawl-evidence?project=project-a&run=run-1",
    );
    expect(evidenceLink.getAttribute("href")).toContain(
      "url=https%3A%2F%2Fexample.com%2Fmissing",
    );
    window.location.hash = evidenceLink.getAttribute("href")!.slice(1);
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(
      screen.getByRole("tab", { name: /URL/ }).getAttribute("aria-selected"),
    ).toBe("true");
    cells = screen.getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toContain("https://example.com/missing");
    expect(cells).not.toContain("https://example.com/");
    expect(onSelectRun).toHaveBeenCalledWith("run-1");
    expect(screen.getByText("Technical detail: HTTP 404 response")).not.toBeNull();
  });

it("sorts URL rows from clickable column headers in either direction", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    const statusHeader = screen.getByRole("button", { name: "Status" });
    fireEvent.click(statusHeader);
    expect(statusHeader.closest("th")?.getAttribute("aria-sort")).toBe(
      "ascending",
    );
    fireEvent.click(statusHeader);
    expect(statusHeader.closest("th")?.getAttribute("aria-sort")).toBe(
      "descending",
    );
    const urls = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => (row as HTMLTableRowElement).cells[1].textContent);
    expect(urls[0]).toBe("https://example.com/missing");
    expect(urls[1]).toBe("https://example.com/");
  });

it("offers a bounded external-link check and invokes it for the selected saved run", () => {
    const externalResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          external_link_count: 1,
          links: [
            {
              target_url: "https://outside.example/path",
              anchor_text: "External",
              is_internal: false,
            },
          ],
        },
      ],
    } as SiteCrawlResult;
    const externalRun = { ...run, result: externalResult };
    const checkExternalLinks = vi.fn().mockResolvedValue(undefined);
    const originalAction = useToolsStore.getState().checkCrawlExternalLinks;
    useToolsStore.setState({ checkCrawlExternalLinks: checkExternalLinks });

    render(
      <CrawlResultsTabs
        result={externalResult}
        runs={[externalRun]}
        selectedRun={externalRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Links/ }));
    expect(
      screen.getByText(i18n.t("crawl.ui.externalTargetSummary", { checked: 0, blocked: 0, invalid: 0, unchecked: 1 })),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.externalLinkLimit")), {
      target: { value: "500" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("crawl.ui.checkExternalLinks"),
      }),
    );
    expect(checkExternalLinks).toHaveBeenCalledWith("run-1", 500);

    act(() =>
      useToolsStore.setState({ checkCrawlExternalLinks: originalAction }),
    );
  });
});
