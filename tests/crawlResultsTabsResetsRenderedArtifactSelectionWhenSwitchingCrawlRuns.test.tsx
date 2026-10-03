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

it("resets rendered artifact selection when switching crawl runs", () => {
    const firstRenderedResult = {
      ...result,
      crawl_mode: "browser-rendered",
    } as SiteCrawlResult;
    const firstRenderedRun = {
      ...run,
      id: "rendered-first",
      result: firstRenderedResult,
    } as CrawlRunRecord;
    const secondRenderedResult = {
      ...result,
      start_url: "https://second.example/",
      crawl_mode: "browser-rendered",
      pages: result.pages.map((page, index) => ({
        ...page,
        url: index === 0 ? "https://second.example/" : "https://second.example/missing",
        final_url: index === 0 ? "https://second.example/" : "https://second.example/missing",
      })),
    } as SiteCrawlResult;
    const secondRenderedRun = {
      ...run,
      id: "rendered-second",
      startUrl: secondRenderedResult.start_url,
      result: secondRenderedResult,
    } as CrawlRunRecord;

    const view = render(
      <CrawlResultsTabs
        result={firstRenderedResult}
        runs={[firstRenderedRun]}
        selectedRun={firstRenderedRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Performance/ }));
    const artifactSelect = screen.getByLabelText(
      i18n.t("crawl.ui.renderedUrlForArtifact"),
    ) as HTMLSelectElement;
    fireEvent.change(artifactSelect, {
      target: { value: "https://example.com/missing" },
    });
    expect(artifactSelect.value).toBe("https://example.com/missing");

    view.rerender(
      <CrawlResultsTabs
        result={secondRenderedResult}
        runs={[secondRenderedRun]}
        selectedRun={secondRenderedRun}
        onSelectRun={vi.fn()}
      />,
    );

    expect(
      (screen.getByLabelText(
        i18n.t("crawl.ui.renderedUrlForArtifact"),
      ) as HTMLSelectElement).value,
    ).toBe("https://second.example/");
  });

it("opens the semantic map from the results header quick action", async () => {
    await i18n.changeLanguage('pl');
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

fireEvent.click(screen.getByRole("button", { name: "Mapa i klastry" }));

    expect(
    screen
.getByRole("tab", { name: /Mapa i klastry/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen.getByRole("img", {
        name: "Interaktywna mapa semantycznych klastrów i linków w treści",
      }),
    ).not.toBeNull();
    expect(
        screen
        .getByRole("tablist", { name: i18n.t("crawl.navigation.resultsTitle") })
        .closest(".sticky")?.className,
    ).toContain("sticky");
  });

it("keeps long result navigation grouped and exposes explicit tab-strip controls", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Crawl result section groups")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Scroll tabs left" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Scroll tabs right" }),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Technical/ }));
    expect(
      screen.getByRole("tab", { name: /Directives/ }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText(/Technical · Directives ·/)).not.toBeNull();
  });
});
