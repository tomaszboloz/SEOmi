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

it("separates transport failures by deterministic kind in the URL filters", () => {
    const transportResult = {
      ...result,
      pages: [
        ...result.pages,
        {
          ...result.pages[1],
          url: "https://example.com/unreachable",
          final_url: "https://example.com/unreachable",
          http_status: 0,
          request_error_kind: "dns",
          title: undefined,
          issues: [{ severity: "Critical", message: "DNS request failed" }],
        },
      ],
    } as SiteCrawlResult;

    render(
      <CrawlResultsTabs
        result={transportResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    fireEvent.change(screen.getByLabelText(i18n.t("crawl.ui.errorTypeAria")), {
      target: { value: "dns" },
    });

    expect(screen.getAllByText("DNS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(dns)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("https://example.com/unreachable").length).toBeGreaterThan(0);
    expect(screen.queryByText("https://example.com/missing")).toBeNull();
  });

it("shows recorded URL discovery provenance in the URL table", () => {
    const provenanceResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              discovery_sources: [
                {
                  kind: "link",
                  source_url: "https://example.com/",
                  anchor_text: "Missing page",
                },
                {
                  kind: "sitemap",
                  source_url: "https://example.com/sitemap.xml",
                },
              ],
            }
          : page,
      ),
    } as SiteCrawlResult;

    render(
      <CrawlResultsTabs
        result={provenanceResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));

    expect(screen.getAllByText(i18n.t("mapUi.discovery.link")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(new RegExp(i18n.t("mapUi.discovery.sitemap"), "i")).length).toBeGreaterThan(0);
    expect(screen.getByText("„Missing page”")).not.toBeNull();
  });

it("shows per-hop redirect timing when the selected run recorded it", () => {
    const redirectResult = {
      ...result,
      pages: result.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              redirect_chain: [
                {
                  from_url: "https://example.com/old",
                  http_status: 301,
                  to_url: "https://example.com/",
                  response_time_ms: 42,
                },
              ],
              redirect_stop_reason: "Redirect limit of 10 exceeded",
              indexability_verdict: {
                status: "uncertain",
                reasons: ["redirect_response"],
              },
            }
          : page,
      ),
    } as SiteCrawlResult;

    render(
      <CrawlResultsTabs
        result={redirectResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /URL/ }));
    fireEvent.click(screen.getAllByText(i18n.t("crawl.ui.showEvidence"))[0]);

    expect(screen.getByText(/42 ms/)).not.toBeNull();
    expect(screen.getByText(/Redirect limit of 10 exceeded/)).not.toBeNull();
    expect(screen.getByText(/uncertain · redirect_response/)).not.toBeNull();
  });
});
