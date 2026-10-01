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

it("opens and scrolls to the map from the page-level navigation request", async () => {
    await i18n.changeLanguage('pl');
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
        mapNavigationRequest={1}
      />,
    );

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
  });

it("exposes the local crawler and AI readiness panel from the grouped results tabs", () => {
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Crawler \/ AI/ }));
    expect(screen.getByRole("heading", { name: i18n.t("crawlerReadiness.title") })).not.toBeNull();
    expect(screen.getByText(new RegExp(i18n.t("crawlerReadiness.scoreLabel")))).not.toBeNull();
    expect(screen.getByText(new RegExp(i18n.t("crawlerReadiness.checks.renderedDom.httpEvidence")))).not.toBeNull();
  });

it("shows rendered Web Vitals separately from navigation timing", () => {
    const renderedResult = {
      ...result,
      crawl_mode: "browser-rendered",
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              rendered_lcp_ms: 1830,
              rendered_inp_ms: 92,
              rendered_cls: 0.042,
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={renderedResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Performance/ }));

    expect(
      screen.getByText(i18n.t("crawlDeepUi.renderedVitals")),
    ).not.toBeNull();
    expect(screen.getByText("1830 ms")).not.toBeNull();
    expect(screen.getByText("92 ms")).not.toBeNull();
    expect(screen.getByText("0.042")).not.toBeNull();
    expect(screen.getByText(i18n.t("crawlDeepUi.renderedVitalsDescription"))).not.toBeNull();
  });
});
