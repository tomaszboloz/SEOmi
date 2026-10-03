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

it("distinguishes checked, broken, and unverified internal targets", () => {
    const internalResult = {
      ...result,
      pages: [
        {
          ...result.pages[0],
          links: [
            { target_url: "https://example.com/missing", anchor_text: "Broken", is_internal: true, target_http_status: 404 },
            { target_url: "https://example.com/not-crawled", anchor_text: "Unknown", is_internal: true },
          ],
        },
      ],
    } as SiteCrawlResult;
    const internalRun = { ...run, result: internalResult };

    render(
      <CrawlResultsTabs
        result={internalResult}
        runs={[internalRun]}
        selectedRun={internalRun}
        onSelectRun={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Links/ }));

    expect(screen.getByText(i18n.t("crawl.ui.internalTargetSummary", { unique: 2, checked: 1, broken: 1, unchecked: 1 }))).not.toBeNull();
    expect(screen.getByText(i18n.t("crawl.ui.uncheckedTargetNote"))).not.toBeNull();
  });

it("offers a confirmed action to free storage by deleting the selected crawl run", async () => {
    const onDeleteRun = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, "confirm");
    confirm.mockReturnValue(false);
    render(
      <CrawlResultsTabs
        result={result}
        runs={[run]}
        selectedRun={run}
        onSelectRun={vi.fn()}
        onDeleteRun={onDeleteRun}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete run" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(onDeleteRun).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete run" }));
    await waitFor(() => expect(onDeleteRun).toHaveBeenCalledWith("run-1"));
    confirm.mockRestore();
  });

it("explains which page count was retained after page-index quota recovery", () => {
    const limitedResult = {
      ...result,
      pages: result.pages.slice(0, 1),
      storage_pages_truncated: true,
      storage_pages_total: 4,
    } as SiteCrawlResult;
    const limitedRun = { ...run, result: limitedResult };
    render(
      <CrawlResultsTabs
        result={limitedResult}
        runs={[limitedRun]}
        selectedRun={limitedRun}
        onSelectRun={vi.fn()}
      />,
    );

    expect(screen.getByText(i18n.t("crawl.persistence.pageIndexNote", { retained: 1, total: 4 }))).not.toBeNull();
  });
});
