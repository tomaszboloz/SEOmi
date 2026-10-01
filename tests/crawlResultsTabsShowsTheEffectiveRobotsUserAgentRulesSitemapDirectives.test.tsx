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

it("shows the effective robots user-agent, rules, sitemap directives, and blocked URL evidence", () => {
    const robotsResult = {
      ...result,
      robots_txt_status: "Loaded 1 applicable robots.txt rules",
      robots_user_agent: "SEOmiDesktopBot/1.0",
      robots_applicable_rules: [{ directive: "disallow", path: "/private" }],
      robots_agent_matrix: [
        {
          user_agent: "GPTBot",
          specific_group: true,
          applicable_rules: [{ directive: "allow", path: "/ai" }],
          crawl_delay_ms: 2000,
        },
      ],
      robots_sitemap_directives: ["https://example.com/sitemap.xml"],
      rejected_urls: [
        {
          url: "https://example.com/private/page",
          reason: "Blocked by robots.txt Disallow rule: /private",
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={robotsResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByText("SEOmiDesktopBot/1.0")).not.toBeNull();
    expect(screen.getByText("DISALLOW: /private")).not.toBeNull();
    expect(screen.getByText("GPTBot")).not.toBeNull();
    expect(screen.getByText("ALLOW: /ai")).not.toBeNull();
    expect(screen.getByText("https://example.com/sitemap.xml")).not.toBeNull();
    fireEvent.click(screen.getByText(new RegExp(i18n.t("crawl.ui.rejectedUrls").replace("{{count}}", ""))));
    expect(
      screen.getByText(/Blocked by robots\.txt Disallow rule: \/private/),
    ).not.toBeNull();
  });

it("shows HTTP and meta refresh declarations as explicit client-side redirect evidence", () => {
    const redirectResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          client_redirects: [
            {
              source: "meta-refresh",
              declaration: "0; URL='/next'",
              delay_seconds: 0,
              target_url: "https://example.com/next",
            },
            {
              source: "http-refresh",
              declaration: '5; url="/later"',
              delay_seconds: 5,
              target_url: "https://example.com/later",
            },
          ],
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={redirectResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Directives/ }));

    expect(
      screen.getByText(i18n.t("crawlDeepUi.clientRedirects", { count: 2 })),
    ).not.toBeNull();
    expect(screen.getByText(i18n.t("crawlDeepUi.mechanismMetaRefresh"))).not.toBeNull();
    expect(screen.getByText(i18n.t("crawlDeepUi.mechanismHttpRefresh"))).not.toBeNull();
    expect(screen.getByText("https://example.com/next")).not.toBeNull();
    expect(screen.getByText("https://example.com/later")).not.toBeNull();
  });

it("shows the effective per-URL robots decision and its evidence sources", () => {
    const robotsDecisionResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          meta_robots: "index, nofollow",
          x_robots_tag: "googlebot: noindex",
          robots_decision: {
            indexability: "noindex",
            link_following: "nofollow",
            directives: ["index", "nofollow", "noindex"],
            sources: ["meta robots", "X-Robots-Tag"],
            response_headers_available: true,
          },
        },
      ],
    } as SiteCrawlResult;

    render(
      <CrawlResultsTabs
        result={robotsDecisionResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Directives/ }));

    expect(screen.getByText(/noindex · nofollow/)).not.toBeNull();
    expect(screen.getByText(/index, nofollow, noindex/)).not.toBeNull();
    expect(screen.getByText(/meta robots, X-Robots-Tag/)).not.toBeNull();
    expect(screen.getByText(new RegExp(i18n.t("crawlDeepUi.headersAvailable")))).not.toBeNull();
  });
});
