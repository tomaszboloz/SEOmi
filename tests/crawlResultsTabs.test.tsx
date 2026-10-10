import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("exposes all result sections as keyboard-accessible tabs", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(18);
    expect(
      screen
.getByRole("tab", { name: /Overview/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("HTTP · JavaScript not rendered")).not.toBeNull();
fireEvent.click(screen.getByRole("tab", { name: /Content/ }));
    expect(screen.queryByText("Example home")).not.toBeNull();
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
      "crawl-tab-content",
    );
  });

it.each([
  "overview", "visualisations", "crawlerReadiness", "urls", "issues",
  "content", "metadata", "customSearch", "links", "media", "frames",
  "social", "directives", "international", "structured", "validation",
  "performance", "exports",
])("mounts crawl result section %s without a route or render error", async (tabId) => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    const tab = screen.getAllByRole("tab").find((candidate) => candidate.id === `crawl-tab-${tabId}`);
    expect(tab, `missing crawl result tab: ${tabId}`).toBeTruthy();
    fireEvent.click(tab as HTMLElement);
    await waitFor(() => {
      expect(tab?.getAttribute("aria-selected")).toBe("true");
      expect(screen.getAllByRole("tabpanel").some((panel) =>
        panel.id === "crawl-tab-panel" && panel.getAttribute("aria-labelledby") === `crawl-tab-${tabId}`,
      )).toBe(true);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

it("renders crawler findings in the active locale while retaining the raw evidence", async () => {
    await i18n.changeLanguage("pl");
    const localizedResult = {
      ...result,
      pages: [{ ...result.pages[0], issues: [{ severity: "Critical", message: "Missing <title> tag" }] }],
    } as SiteCrawlResult;
    const localizedRun = { ...run, result: localizedResult };

    render(
      <CrawlResultsTabs
        result={localizedResult}
        runs={[localizedRun]}
        selectedRun={localizedRun}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Problemy|Issues/ }));
    await waitFor(() => expect(screen.getByText("Brak tagu <title> strony")).toBeTruthy());
    expect(screen.queryByText("Missing <title> tag")).toBeNull();
  });
});
