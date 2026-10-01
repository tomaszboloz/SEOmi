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

it("shows only declared favicon and social metadata without inventing or downloading preview images", () => {
    const socialResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          favicons: ["https://example.com/favicon.svg"],
          social_meta_tags: [
            { key: "og:title", content: "Declared share title" },
            { key: "og:image", content: "https://example.com/social.png" },
            { key: "twitter:card", content: "summary_large_image" },
          ],
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={socialResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Social cards/ }));

    expect(screen.getByText("Declared share title")).not.toBeNull();
    expect(screen.getByText("https://example.com/social.png")).not.toBeNull();
    expect(screen.getByText("https://example.com/favicon.svg")).not.toBeNull();
    expect(screen.getByText("summary_large_image")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

it("shows fetched status and byte metadata for optional social-image and favicon resource checks", () => {
    const socialResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          favicons: ["https://example.com/favicon.svg"],
          favicon_resource_checks: [
            {
              url: "https://example.com/favicon.svg",
              checked_in_run: true,
              http_status: 200,
              content_type: "image/svg+xml",
              content_length: 512,
            },
          ],
          social_meta_tags: [
            {
              key: "og:image",
              content: "https://example.com/social.png",
              resource_check: {
                url: "https://example.com/social.png",
                checked_in_run: true,
                http_status: 404,
                content_type: "text/html",
                content_length: 91,
              },
            },
            {
              key: "twitter:image",
              content: "https://cdn.example.net/card.png",
              resource_check: {
                url: "https://cdn.example.net/card.png",
                checked_in_run: false,
              },
            },
          ],
        },
      ],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={socialResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Social cards/ }));

    expect(screen.getByText(/HTTP 200/)).not.toBeNull();
    expect(screen.getByText(/512 B/)).not.toBeNull();
    expect(screen.getByText(/HTTP 404/)).not.toBeNull();
    expect(screen.getByText(/Not checked in this run/)).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

it("shows favicon declaration metadata when the crawler provides it", () => {
    const socialResult = {
      ...result,
      pages: [{
        ...result.pages[0],
        favicons: ["https://example.com/favicon.svg"],
        favicon_metadata: [{
          href: "https://example.com/favicon.svg",
          rel: "icon",
          declared_type: "image/svg+xml",
          declared_sizes: "any",
          inferred_format: "svg",
        }],
      }],
    } as SiteCrawlResult;
    render(
      <CrawlResultsTabs
        result={socialResult}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Social cards/ }));

    expect(screen.getByText("rel=icon · type=image/svg+xml · sizes=any · format=svg")).not.toBeNull();
  });
});
