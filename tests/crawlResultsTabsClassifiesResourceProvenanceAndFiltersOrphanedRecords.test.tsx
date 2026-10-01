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

it("classifies resource provenance and filters orphaned records", () => {
    const resultWithResourceProvenance = {
      ...result,
      resources: [
        {
          source_urls: ["https://example.com/"],
          url: "https://example.com/referenced.css",
          resource_type: "stylesheet",
        },
        {
          source_urls: ["https://example.com/removed"],
          url: "https://example.com/orphan.css",
          resource_type: "stylesheet",
        },
        {
          source_urls: [],
          url: "https://example.com/legacy.css",
          resource_type: "stylesheet",
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={resultWithResourceProvenance}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Media/ }));

    expect(screen.getByText(i18n.t("crawl.resources.provenance.referenced"))).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("crawl.ui.orphaned") }));
    expect(screen.getByText("https://example.com/orphan.css")).not.toBeNull();
    expect(screen.queryByText("https://example.com/referenced.css")).toBeNull();
  });

it("shows iframe declarations separately from unverified rendered browser frames", () => {
    const resultWithFrames = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              frames: [
                {
                  src: "../embed",
                  resolved_url: "https://example.com/embed",
                  title: "Player",
                  loading: "lazy",
                  sandbox: "allow-scripts",
                  checked_in_run: false,
                },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={resultWithFrames}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Frames/ }));

    expect(screen.getByText("https://example.com/embed")).not.toBeNull();
    expect(screen.getByText(i18n.t("crawl.ui.notChecked"))).not.toBeNull();
    expect(
      screen.getByText(i18n.t("crawl.ui.framesDescription")),
    ).not.toBeNull();
  });

it("shows schema findings with their source URL, declaration format, and property path", () => {
    const schemaResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              schema_validation_findings: [
                {
                  format: "JSON-LD",
                  declaration_index: 1,
                  finding: {
                    code: "product-name-empty-or-invalid",
                    severity: "warning" as const,
                    message:
                      "Product name is present but is not a non-empty string.",
                    path: "$.@graph[0].name",
                    recommendation: "Use the visible product name.",
                  },
                },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={schemaResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Structured/ }));

    expect(screen.getAllByText("https://example.com/").length).toBeGreaterThan(
      0,
    );
    fireEvent.click(screen.getByText("1 finding(s)"));
    expect(screen.getByText("Warning · JSON-LD #1")).not.toBeNull();
    expect(screen.getByText("$.@graph[0].name")).not.toBeNull();
  });
});
