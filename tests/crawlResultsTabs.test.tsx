import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("mounts every crawl result section without a route or render error", async () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    const tabNames = screen
      .getAllByRole("tab")
      .map((tab) => tab.textContent?.replace(/\s+/g, " ").trim())
      .filter((name): name is string => Boolean(name));

    expect(tabNames).toHaveLength(18);

    for (const tabName of tabNames) {
      const tab = screen
        .getAllByRole("tab")
        .find((candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === tabName);
      expect(tab, `missing crawl result tab: ${tabName}`).toBeTruthy();

      await act(async () => {
        fireEvent.click(tab as HTMLElement);
      });

      await waitFor(() => {
        expect(
          (tab as HTMLElement).getAttribute("aria-selected"),
          `tab ${tabName} was not selected`,
        ).toBe("true");
        expect(screen.getAllByRole("tabpanel").length).toBeGreaterThan(0);
        expect(screen.queryByRole("alert")).toBeNull();
      });
    }
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
