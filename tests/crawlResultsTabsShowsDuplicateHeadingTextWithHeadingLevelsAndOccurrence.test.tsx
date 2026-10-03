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

it("shows duplicate heading text with heading levels and occurrence count in Content", () => {
    const resultWithDuplicateHeadings = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              duplicate_headings: [
                { text: "Quick start", levels: [2, 3], occurrences: 2 },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={resultWithDuplicateHeadings}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
fireEvent.click(screen.getByRole("tab", { name: /Content/ }));

    expect(screen.getByText("H2/H3 × 2: Quick start")).not.toBeNull();
  });

it("shows content-only readability and top-term evidence per crawled URL", () => {
    const resultWithContentMetrics = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              sentence_count: 3,
              complexity_score: 81,
              complexity_label: "simple",
              readability_ease_score: 74.2,
              readability_grade: 6.1,
              readability_label: "standard",
              content_terms: [{ term: "espresso", count: 4, density_percent: 12.5 }],
              focus_phrase: { phrase: "espresso guide", body_occurrences: 2, body_density_percent: 8.3, title_occurrences: 1, meta_description_occurrences: 1, h1_occurrences: 1 },
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={resultWithContentMetrics}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
fireEvent.click(screen.getByRole("tab", { name: /Content/ }));

    expect(screen.getByText("74/100")).not.toBeNull();
    expect(screen.getByText("espresso 12.5%")).not.toBeNull();
    expect(screen.getByText(/espresso guide: body 2/)).not.toBeNull();
    expect(screen.getByText(/Flesch-like/)).not.toBeNull();
  });

it("shows measured HTTP response-header timing for checked resources", () => {
    const resultWithResources = {
      ...result,
      resources: [
        {
          source_urls: ["https://example.com/"],
          url: "https://example.com/site.css",
          resource_type: "stylesheet",
          http_status: 200,
          content_type: "text/css",
          content_length: 42,
          response_time_ms: 17,
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={resultWithResources}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Media/ }));

    expect(screen.getByText("17 ms")).not.toBeNull();
    expect(
      screen.getByText(i18n.t("crawlDeepUi.resourceTimingNote")),
    ).not.toBeNull();
  });
});
