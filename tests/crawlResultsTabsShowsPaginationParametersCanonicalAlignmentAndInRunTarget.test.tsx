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

it("shows pagination parameters, canonical alignment, and in-run target status", () => {
    const paginationResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          canonical_relation: "self",
          pagination_declaration_count: 1,
          pagination_invalid_declaration_count: 0,
          pagination_canonical_alignment: "self-canonical",
          pagination_links: [
            {
              relation: "next",
              target_url: "https://example.com/articles?page=2",
              query_parameter_changes: ["page: 1 → 2"],
              http_status: 404,
              checked_in_run: true,
            },
          ],
        },
        {
          ...result.pages[1],
          pagination_declaration_count: 1,
          pagination_invalid_declaration_count: 1,
          pagination_canonical_alignment: "invalid-canonical",
          pagination_links: [],
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={paginationResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /International/ }));

    expect(
      screen.getByText(i18n.t("crawlDeepUi.pagination")),
    ).not.toBeNull();
    expect(screen.getByText("self-canonical")).not.toBeNull();
    expect(screen.getByText("HTTP 404")).not.toBeNull();
    expect(screen.getByText("page: 1 → 2")).not.toBeNull();
    expect(
      screen.getByText(
        i18n.t("crawlDeepUi.invalidPaginationTarget"),
      ),
    ).not.toBeNull();
  });

it("shows hreflang status, reciprocal result, and canonical alignment only when verified", () => {
    const hreflangResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          document_language: "pl",
          amp_url: "https://example.com/en/amp/",
          amp_target_http_status: 404,
          amp_target_checked_in_run: true,
          hreflangs: [
            {
              language: "en",
              target_url: "https://example.com/en/",
              target_http_status: 200,
              target_checked_in_run: true,
              reciprocal_in_run: true,
              target_canonical_alignment: "self-canonical",
            },
            {
              language: "de",
              target_url: "https://outside.example/de/",
              target_http_status: null,
              target_checked_in_run: false,
              reciprocal_in_run: null,
              target_canonical_alignment: null,
            },
          ],
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={hreflangResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /International/ }));

    expect(
      screen.getByText(`HTTP 200 · ${i18n.t("crawlDeepUi.yes")} · self-canonical`),
    ).not.toBeNull();
    expect(
      screen.getByText(
        `${i18n.t("crawlDeepUi.statusOutsideRun")} · ${i18n.t("crawlDeepUi.reciprocityUnchecked")} · ${i18n.t("crawlDeepUi.canonicalOutsideRun")}`,
      ),
    ).not.toBeNull();
    expect(screen.getByText(i18n.t("crawlDeepUi.ampStatus"))).not.toBeNull();
    expect(screen.getByText("HTTP 404")).not.toBeNull();
  });
});
